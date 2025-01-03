---
layout: post
title:  "Program Explorer Planning"
date:   2024-06-27
categories:
---

Note: this has become more of a brain dump that I'm updating over time, so reader beware

I've been cooking up some ideas for a project tentatively called Program Explorer which is like Compiler Explorer but for any container. Initially the containers would be of a similar text-in to text-out as for compilers, but we can imagine supporting arbitrary outputs like images in the future. The user edits some input file(s), chooses a container, and gets the output sent back to them in the browser.

Many projects offer playgrounds for programming languages or other tools, PE (program explorer) would make it super easy to create new playgrounds.

Initially, I want to start with a curated allowlist of containers but we can imagine expanding that somehow in the future.

One target to keep in mind is that PE could/should be able to subsume Compiler Explorer (and any other playground), where the compiler specific viewing tools etc are more of a frontend responsibility than the backend service which just takes care of running containers on inputs and sending back outputs. Likewise for other domains outside compilers, it might be useful to have a more tailored user interface that makes more sense for. For example, containers which return images (png, jpeg) would display the image (duh) and containers which return 3d models would load the response in a 3d viewer. In addition to the types of things they display, there might be groups of options/forms that a subset of related containers make use of and we should have a way to display these when someone is working in a particular domain.

One organizing aspect that will be useful with lots of containers is to categorize them based on what kinds of inputs they take and what kinds of outputs they produce. It would be nice if there was a mime type for every source language for example, but I don't think that is true. This is a many to many relationship. This could make it easy to populate the list of containers you might want to run given some input file you have open in the browser.

Having a nice user interface that approaches compiler explorer is hard to do in general because there is a lot of shuffling of argv and crap, but one thought is to have some kind of metadata for each container that could describe at least a subset of options in a way that we could render them as an HTML form so that when selecting a container, we get a user interface of what the options are. And for example options with choices get a select box and options that are integers get a number field etc.

The backend should really only be concerned with running a container with some argv, env, and inputs. I don't think stdin/stdout is sufficient for many programs since we'll want to support returning multiple outputs without for example piping tar to stdout. So, I think we'll want to support sending an input to stdin but also a mapping of files that should exist. Questions: what path do these go in? should it be the cwd? should they be absolute? should they always be in /in or something like that? can the user override cwd? should the user have to specify which output files it is interested in receiving?

The backend needs to run each container in a VM for isolation. Initially (or always?) the container program will have no network access. Question: does it get time access? This rules out many cloud VM options because they don't support nested virtualization. I need to evaluate kata containers and whether that is a win or if it will get in the way. It seems like there is a bunch of useful learnings on getting fast boot times but I'm not sure it is significantly better than just using libvirt.

Because we are going for small interactive use, we'd like to minimize latency which means VM boot and container init is a big consideration. Firecracker seems potentially useful but looks like no GPU support and that is something I would want to support (in addition to other devices) in the future, though we could always use more than one vmm.

Architecture wise, we'll have a load balancer that also does caching and then multiple worker machines.

A simplifying assumption in the beginning is that all containers will run with 1 CPU and (wlog) 1 GB of memory with a maximum runtime of 10 seconds. Also, every worker machine will have all container images on local disk. This means the worker pool is uniform and we don't have to do heterogeneous resource scheduling

Each worker of N CPUs will manage N - k workers. Kata can use an agent inside the VM which is one option, but it might be nice if we could it without that. We do need to "exfiltrate" the outputs somehow. I'd like to avoid using real disk space and only give the VM tmpfs, not sure if we can mount in a tmpfs into the VM that we could then read from the host after it's done in order to send the response. This is tied with what the networking flow looks like so let's talk about that.

The networking flow is a bit annoying. In my ideal case, I think the browser should begin sending a multipart request with the first part being a json descriptor of the container, env, argv, etc. The load balancer could read this first part, check the cache, and return an immediate response if it is found. The multipart request is because it would be nice to send any eg. binary files as separate parts so that we don't have to stuff them in the json body. But, if we want an early response from the server, the server must read the entire request before sending a response. Or actually, it can send a response early, but still has to read the entire request. It could close the connection, but we want to reuse the connection! And the browser can't read any of the response before/while the request is being written/sent. Another draw on the multipart request is that the load balancer can forward that data to the worker without buffering it in memory. Likewise, the worker sending its response can use multipart with a json part at the beginning that gives some info on the execution, followed by one part for each file it is returning, and that can all get forwarded back to the client.

This networking flow pushes us away from a job queue so that we can forward the request without buffering it somewhere. For this reason, I think one solution would be a pull based system where each worker host or worker VM (not sure yet) would send a ready request to the load balancer. Then, the load balancer can keep a pool of ready worker connections and write the request stream to the worker response stream. Then, the worker sends a done request and the load balancer can write the request stream to the user's response stream. We can also tee this for caching.

If each worker VM has network access filtered to the load balancer and there is an agent inside the worker VM, we can make request from inside the worker VM to the load balancer and that gives us a pretty clean 2 network stream client <-> load balanceer <-> worker vm setup. Alternatively, we could have the VM only with local network that might connect to a standard proxy on the worker host which forwards to the load balancer. This might be nice if it takes care of auth and would further restrict the VM network access. That might also be possible to do with a unix socket instead of configuring any network stuff. One complication with the VM making the network request out is that in the "normal" case of a job exceeding its runtime limit, the agent (inside the VM) can send a response saying things took too long. But if for some reason there's a container escape or the VM agent dies, we'd like an agent on the worker host to send a response sayingg things went bad. But maybe the load balancer can just set its own timer and take care of notifying the user?

The simplest case for a worker host agent is to manage a pool of N - k VMs and restarting them when one of them finishes a job. It might have more responsibilities if it is involved in the network flow or in the future when it needs to maintain the pool of container images or notifying the load balancer of what capabilities it has.

Thinking about this more, I'm inclined to not have the VM be the one making the network response to the load balancer so that as soon as the job is complete and the output is written, the VM can be rebooted. If it had an open network connection, it would have to stay open until the client has consumed the response. And if the client is slow, this would hold things up. Only in special cases could we have fully streamed the output to the client anyways, so requiring the job to write the output to tmpfs fully isn't that bad (and outputs are smallish in the initial case). From the request side, it also might make sense to fully stream in the request to the worker so that the VM can startup while the network transfer happens. This is slightly at odds with optimal queueing but might be worth it for latency hiding. I think this is equivalent to each worker host requesting N+k jobs when it has N VM capacity. This brings up another point where once core counts creep up as they are, is it okay to have one request per job (eqv one request per VM)? If we use http2 between load balancer and worker, I think it might be fine (stream multiplexing); but then that forces us to use it between client and load balancer if we want to stream the response.

Okay so if the VM has no networking, we need to get the inputs into the VM and out via the host. From my purusing, it looks like the options are: agent communicating over a vsock or vserial doing essentially what a virtiofs would do, actually using virtiofs which is fuse over a vsock (I think), something crazy like sharing a memory /dev/shm from the host and having the VM tmpfs mount from that address pool (is that even possible?). I suppose the virtiofs is actually the closest, though ideally we could keep the memcpys down. The input files are coming off the network and the host reads them. If we can keep them in memory without writing them again to tmpfs that would be nice. This means we'd want a virtiofsd that could take a wlog cpio archive in /dev/shm and serve read requests from it. The output is a bit trickier: in the nicest of cases, the program we run will do a single in-order write of the output file(s) which could conceivably be streamd through a cpio thing to end up on the host in memory via the in-memory virtiofsd. But, if the program uses actual fs semantics and writes, then overwrites some bit, etc, we need it to act like a regular fs anyways. So then we'd almost rather it be a tmpfs on the guest with maybe a final `cp /tmp/out.o /output/out.o` in the inevitable shell script to run the job. All these memcpys are so lame! So now it seems like if you're counting memcpys, having the guest with networking might actually win. We boot into the guest and request a job. We get the first part of the response which tells us which container. We either have a virtiofs host share with all the container images or maybe hotplug a disk device with that specific container (but that requires the host knowing which container we want, so prolly not, unless we duplicate packets or something stupid). We can then start that container which takes a bit of time. Meanwhile, we start reading all the network packets for the input files. If we use an in-memory fuse fs for the input, we can even have the binary run right up until it asks for some input file and we'll already have it or can wait until we do. Otherwise we have to write the output to tmpfs and wait for all input files to arrive before starting the job which isn't as nice. For the output, I don't see a better way around it than having to wait for the job to finish before sending the first byte of the first output file because regular fs semantics means we can't know if the writer will rewrite some of that file. Boo regular fs semantics. So job finishes and we're left with some files in /out and we need to send them back to the client via the load balancer. Assuming that link is fast, we shouldn't have much variable delay in sending the output so that we can shutdown the guest as quick as possible. Then its up to the load balancer to buffer the output and send it to the variably slow clients. In the full streaming case we'd only send as fast as the client consumes but then our guest is kept around longer than we want. I'd like to read more about the virtio network drivers but it kinda seems like this might actually be the path of least memcpys because I'm guessing the guest grabs the packets almost directly to/from the nic? I'm just a bit nervous about the guest having network and will need a different design for anything that is a non-container job in the future. The fuse thing is super nice for a flat list of files without directories or permissions or attributes, and gets less appealing if all those things are necessary. But they aren't for most of the jobs I'm thinking of right now. Wait but fuse requires SYS_ADMIN in the container, oh no (but see [this](https://github.com/pfnet-research/meta-fuse-csi-plugin)).

Which is another thing I've been wondering about: is http2 actually desirable for this service? My main thinking is about connection keepalive so would also pertain to http1.1, but suppose we limit the number of connections to the load balancer to 10k. Suppose we are at that limit, some connections are sending request data in, some are receiving response data, and others are idle. We get a new request coming in and we have to decide what to do? Reject with 503? Send GOAWAY to one of the idle connections (this requires marking/tracking which connections are in which state)? Is this possible with a proxy in front of the load balancer process?

As for containers, if we don't use kata containers, I have a bit of thing for singularity containers because they start much faster in my brief testing so far. You don't get layer sharing, though can we do this at the filesystem level? I know AWS Lambda went to great depths to share at the block level. Assuming singularity containers, we prebuild all the container images and keep them in a folder. The image folder gets mounted with virtio-fs to the VM and then we do a singularity run inside there. Is it okay to have all the images in one folder? Are we paranoid about having them all exposed if a container escape? If we're running on decent machines, having 10k 100MB images is 1 TB and should be no problem.

For storage, I don't want any persistent storage access in the container, just tmpfs. Need to figure out if we can mount tmpfs to a guest vm from the host. Will it screw up too many containers if there's no writable layer? We can always do a tmpfs overlay and maybe that is the simplest.

I anticipate many containers will need a small shim layer to make them run nice in this environment and I'm thinking about whether this is best done outside the container with a supervisor thing or if we should derive custom containers for every container that takes care of the housekeeping. This could be really annoying. Eventually maybe having some kind of pseudo-standard and developers could publish an image conforming to it. Then, we could pull in any open source project that publishes a container and have a playground for it (especially if it defined some metadata about what the user interface should look like). Also an eventually thing.

Why not Lambda? Not totally sure, I guess vague worries about variable cost since I want this to be free for many many people and many many containers. And eventually supporting hardware configurations that lambda doesn't offer. Why not another FaaS? Not sure either.

Another piece that I'd like to eventually support is benchmarking on real hardware and have a large variety of CPU models and architectures (GPU too?) that run in a benchmarking friendly environment (this makes a pull model attractive so that odd hardware only needs network access to the load balancer and not vice versa; like it could be in someone's basement). ARM and RISC-V would be good to have even before benchmarking. Embedded devices?

Also maybe eventually support different kernel versions. And even baremetal if possible?

Of course, I'd like this to work in a self-hosted manner as well so that you can bring your own compute. I want to keep that in mind but not sure it will be the primary guiding principle in development or secondary. Just not sure yet because there are loads of variations. I know lots of orgs give out cloud accounts now so that could be nice if you could plug it in to that but that's a ton of complexity in itself. If you're just running on your own machine, that is still different than running the worker on a dedicated machine which is what the production setup would be like.

On container image file sharing, I thought of one possible simple way to share files between container images from sqfs is to build a combined image prefixing each rootfs with `/a`, `/b` etc and then we mount the image somewhere like `/mnt/combined` and then bind mount the chosen one to `/run/bundle/rootfs`. Because sqfs (and I think erofs but haven't played with that yet) do same-file sharing (erofs also supports block sharing but then you don't get compression so not sure the tradeoff), you get savings. A quick test:

```
gcc-13.3.0.sqfs     421.45 Mb (compressed)    1347.61 Mb (uncompressed)      22806 files       2850 dirs
gcc-14.1.0.sqfs     432.04 Mb (compressed)    1381.28 Mb (uncompressed)      22894 files       2852 dirs

20179 files 832.07 Mb (uncompressed) shared = 60.24%
```

I don't know if you can append (you should be able to by choosing a prefix greater than all before since they are both (I think) sorted) to either sqfs or erofs but that would make a nice incremental update when a new version came out.

Okay tons more tiny things I'm obsessing over so need to write it out. First, decide on an input/output format for both the host/guest interface and the client/server interface. I'd like to do something that supports multiple files both in and out, perms and mtime aren't that interesting to me right now so mainly file hierarchy and contents. Considerations are what is good to support in browser, can the browser craft the input payload and can we trust that payload or do we need to verify it (likely verify) and/or should we just build the payload on the server. Let's say the client sends the files as a multipart upload and the server creates a squashfs with them, then we can mount them in the vm and we're good. If we're really reaching, we'd probably try to pre-boot the workers and hotplug the disks for container and input payload when we need them but would need to benchmark to see if that is actually worthwhile (probably is faster since it seems like min kernel boot time is >50ms) but we should try the easy thing first with less moving pieces ie just one exec call vs using the http api (though that is also prolly not as bad as I think). So then for output, we can mount a size limited tmpfs for all the output files (though then you can't just `mv` an output file from the working dir to the output dir...) or we just have to verify the output size as we're exporting it. Anyways either from a predefined list of files to include (do we allow globs?) we build a cpio/zip/tar/http-multipart/sqfs/erofs something inside the guest and get it out to the host either via vsock or pmem (can we pass a shmem file to pmem to be fully memory backed there?) and then send that back to the client. The client can then iterate over and show things. multipart response is probably the most native to the browser (though then there's possible filename encoding mismatch)  as it will already have split the buffers. Okay but I can't actually figure out if FormData responses to the client are a thing in the browser? I see `Response.formData() -> Promise<FormData>` that is advertised as for service workers intercepting requests and also nothing about the return type of `FormData.get()`, like what if it is a blob? For a single multipart response, we also get all-or-nothing gzip (or potentially zstd if supported) compression between client and server; but it would get handled not in javascript which is a plus. If we send a blob of sqfs or erofs and parse it in the browser, assuming no compression in the payload itself so we also get transfer compression, then we could probably write a little wrapper to unpack the format, it doesn't look too crazy. I do wonder (over engineering beware) whether the blob gets shared if we extract a subsequence? I think if we convert to a string to show in an editor it will almost definitely get copied.

Okay getting a bit closer on transferring files into and out of the guest container. The setup I have working so far looks like this:

```
# host vm prepares input files into a squashfs with structure stdin,dir/...
# also an empty output file
# both need to be truncated to the nearest 2M size for use with cloud hypervisor --pmem
# we pass 3 pmem files:
#   /dev/pmem0 the rootfs sqfs
#   /dev/pmem1 the input sqfs
#   /dev/pmem2 the output empty file

# guest vm directories
# /mnt/work
# /mnt/rootfs
# /mnt/upper/{scratch,input,output}
#
# /run/{intput,output}
# /run/bundle/rootfs

mount -t squashfs -o loop /dev/pmem0 /mnt/rootfs
mount -t squashfs -o loop /dev/pmem1 /run/input
mount -t tmpfs -o size=2M none       /run/output
mount -t tmpfs -o size=2M none       /mnt/upper/scratch

mkdir /run/output/dir

mount -t overlay -o lowerdir=/mnt/rootfs,upperdir=/mnt/upper,workdir=/mnt/work none /run/bundle/rootfs

# the config.json in /run/bundle has mounts for:
# tmpfs on /scratch
# bind /run/output/dir:/output
# bind /run/input/dir:/input
/bin/crun run --bundle /run/bundle containerid-1234 \
        < /run/input/stdin \
        > /run/output/stdout \
       2> /run/output/stderr
echo $? > /run/output/exit

(cd /run/output; busybox find . -print -depth | cpio -H newc -o > /dev/pmem2)
```

Starting with the input side, the host creates a squashfs of the stdin and input files under `/dir`. This gets passed as pmem1. Anything under `/dir` will be available at `/input` in the container. We use the file `stdin` in this sqfs to be the container's stdin. This is a non-interactive stdin and I think is useful but is maybe pointless.

For the output side, the guest creates a tmpfs `/run/output` and a subdir `/run/output/dir`. We capture stdout and err to `/run/output/std{out,err}` and mount `/run/output/dir` to the container's `/output`. We then create an archive (cpio for now) of everything in `/run/output` and write it to pmem2. This will terminate if it exceeds the size of the pmem2 file which is good.

Because the container's rootfs is a readonly squashfs filesystem, we can't mount any new directories like `/input`, so we have to create an overlayfs with the mountpoints we want which is where `/mnt/upper` comes in. This gives us the three root dirs `{input,output,scratch}` to overlay on the container's rootfs. (TODO: can we limit the size of `/mnt/work` somehow?).

For both the input and output side, we use the root (relative root) as a "privileged" place to put `std{in,out,err}` and `exit` files and anything under `dir` is what gets mounted into the container at `/{input,output`.

So when a new request comes in, we create a squashfs file from the request stream and truncate it to the nearest 2M. We create an empty output file at whatever our limit size is to the nearest 2M. We run the worker. We send the file archive to the client making sure to cut it short and not send the oversized pmem file in its entirety. cpio has a trailing file suitable for this purpose but not sure about others yet.

A slightly simpler input format would be just writing a cpio archive for the input file. The downside here is that then we have to unpack it to get started. It looks like squashfs-tools-ng does support creating a squashfs file without requiring writing the files to the fs. It might be nice to just require the sender to send a valid squashfs file but I don't think thats happening from the browser. And I don't know of any other archive format with good kernel support for mounting. Another tricky idea would be if we had a cpio of the input we could concat it onto the initramfs and have the kernel unpack it on boot. Downside of that is that we have to write out that portion of the initramfs file each time, but maybe ch could get patched to support a two part file? But then we have to prefix the input files so they end up in `/input` or something so also not looking great.

Okay think I'm going with the simpler way of just using cpio for now. squashfs-tools-ng is pretty complicated and who knows how robust, would definitely want to build the squashfs image inside the guest so the webserver isn't vulnerable. the original squashfs and erofs both aren't library oriented or non-fs oriented. I briefly considered writing a simple erofs writer since it doesn't seem too bad, but too much of a distraction at this point. I think I'll just dump the request body into a shared memory file and hand that as a pmem, then have the guest init system populate the input dir. Besides the request body which contains the input files, it will also need to pass some user data like env vars, args to the program, anything else that needs to go into config.json. It would be convenient to put those all in the same place, but for sure some parts of that I'll want to be only set by the server and some settable by the client request. One example would be if I'm using a multi-rootfs squashfs image, then I'll need to specify the root dir inside the image to use (instead of `lowerdir=/mnt/rootfs` it would be `lowerdir=/mnt/rootfs/gcc-13.3.0`). That does make me want to experiment more with getting the system to boot without any pmem devices and having init just wait for them to exist, does inotify work on devices? Or what is the right notification mechanism there? Okay yes, inotify on /dev does work watching for new files to be created

One thing I can't quite get my head around is what user and/or user namespace should I be running the container in. If you run crun as root, it can create the user namespace and uid/gid mappings without invoking newuidmap/newgidmap helpers, but then you're running all of crun as root. If you run crun as 1000 then you ... fill me in later. What should the uid be inside the container and how should that be mapped outside the container? I have it running with crun root running with user ns and user 1000 inside, all the files from the container's rootfs show up as nobody=65534 in the current testing gcc /etc/passwd but the folders /input /output and /scratch are all 1000/1000 fine. Also ran into a [situtation](https://github.com/containers/crun/issues/1536) when the guest doesn't have a /etc/passwd in

Multipart form data seems a mess and not worthwhile. I can't really find a good library to do it ideally in rust as a sans-io since I'll have the whole body in the pmem file. I just want an iterator over name + filename + contents triples. But then there's all sorts of issues with the filename encoding having weird rules. The most definitive thing is probably just reading the [chromium source](https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/network/form_data_encoder.cc) and I was thinking I could pull something like that and the decoder to do it, but that would be a PITA. I think I'm just going to go with a much simpler bencode of `(filepath,data)+` and filepath can be whatever bytes and I can build the file tree with `openat2` with `RESOLVE_IN_ROOT` on the `/input` dir. Maybe I should enforce the filepaths to go in sorted order. Anyways I'm thinking a trie to keep track of which dirs are created. Or create the file optimisitically and if it fails, just try a `create_dir_all`. Or if we instead do `n filepath{n} data{n}` we could run through all the filepaths and create the dir structure. Also makes it easy to check for duplicate files. Anyways, one other tidbit is that when the webserver gets the request body from the client, we need to put that into a pmem compat file, meaning it is truncated upwards to 2MB alignment. This means the reader inside the guest then doesn't get to know the original size. So I'm thinking we reserve the first 4 bytes for a size? And since its http we know we'll have a content-length header? Is that terrible? The other bit we need on the webserver side is some of the request data, most importantly the name/id of the container. This is important because we'll have to do a lookup to find the right file and subdir folder name to both mount for the guest and also pass to the guest so that it can mount the right container rootfs, and in the case where we've bundled multiple containers into one sqfs, it can pick out the right subdir after mounting. Eventually this might also be things like architecture, mem amount, etc. One thought is to put this data in a "file" named something like `!config.json` so it always appears first and the server can pull it out, then just directly copy the rest of the body into the pmem file, maybe including the config also. The webserver could then write its own `!config.json` for the guest to read and the rest of the files would be user. I worry slightly about a confused sheriff type "attack" so maybe a different channel that doesn't cross with user created inputs is better. I actually haven't decided how to then communicate something like the subdir path to the guest. I'd like to keep the number of pmem files minimal, which is 3 right now with container fs, input, and output. And so then maybe I'll return the output metadata like exit status, time spent, etc in a pseudo file like `!info.json` at the beginning of the response.

That also makes me think of whether it is better to have the timeout on the cloud-hypervisor process on the host or on the crun process on the guest or both? Certainly host side makes sense, not sure guest also makes sense.

Okay bencode is actually annoying b/c of the variable sized reads, so I'm maybe just going with le bytes, u16 for the path and u32 for the data. Then you can do a `m = read(2)` to the get the path, then `n = read(m + 4)` to get the path and data size, then a `copy_file_range`. And actually what I'm realizing is how annoying not having something like `mkdir -p` built into the kernel is and why (besides being able to set the extra mode bits etc) archive programs have dir's as an entry and expect them to come before their children. Then you just do what the thing says and if it fails it isn't your fault. Otherwise, you're responsible for figuring out and/or keeping track of which dirs need to be created.

I did a little side testing on the archive front and put that work in a repo [archive-testing](https://github.com/aconz2/archive-testing). This supersedes whatever I was thinking above.

I realized that I can use a single pmem file for both the input and output (assuming input and output max file size is the same, or I take the max of them). The guest reads the input file and unpacks the archive, runs the container, then builds an archive and puts it in the output file. That is nice.

And I think I will go with a slightly more complicated pmem file format to combine the config and misc stuff and the archive. That format from the client is `<json blob size><json blob><archive_blob>` of total length `content_length` (the header). On the server, we parse the json blob to pull out the requested container etc. and then write into the pmem file `<json blob size><json blob><archive_blob_size><archive_blob>`. This json (or other format) blob will have any information the guest init system needs to prepare the container. `archive_blob_size` is computed from the `content-length` header. One aspect of this system is that the webserver only needs to read the first json blob bytes, compute a new json blob, write it out, then pipe the rest of the request stream into a file which can be zero-copy (well really one copy but depends on how you count; and maybe not really because of encryption). Remember we need to write the `archive_blob_size` because the pmem file is truncated up to 2MB. We can compute the size needed for this file once we've generated the json that goes to the guest. Once the guest has finished running the container, it writes a similar format back into the same pmem file of `<archive_blob_size><json blob size><json blob><archive_blob>` which is again a file of longer length because of the truncation. This output json blob can hold things like exit status, time spent, other stats etc. We can then compute the response `content-length`, strip the `archive_blob_size` and stream the rest straight from the file. So the flow of the server takes a nice shape of just passing these input/output files around; server streams them into a file, that goes to a queue, workers take in a file, execute, and put back a file, the output file then gets streamed back. We'll need to bound the total number of in-flight files based on memory capacity and whatever limit per request we set. This also means we might have open but waiting requests that haven't started streaming into a file yet because they are waiting for a file to be available.

One thing to note about `/dev/pmem*` is that the file length comes back as zero. You can memmap it but you have to provide the length.

Note about http that I didn't understand before: content-length is not always set because you can stream chunks of a body with transfer-encoding: chunked. Above I mention writing the archive file with a preceding archive size taken from the content-length header which isn't necessarily known if using transfer-encoding. That is fine we just have to save room for it upfront and then stream the rest into the file. I also talk about it how it screws up possible caching happy path where the client delays sending the input files and just the config so we can first lookup in the cache whether we have a result already and yadda yadda. Well the nice thing is that we can do this with the stream api in the browser and send the config data in the first chunks, let the server think and if it does get a cache hit, it sends an immediate response in a first chunk that says "send more" or "here you go". Idk if that's too complicated but it is an option (I think).

Note about cloud-hypervisor api usage. Basically if you start a ch instance and immediately send an api request like vm.add-pmem, the first response I was getting was `Ok(None)` and the second was `Ok(Some("{\"id\":\"_pmem0\",\"bdf\":\"0000:00:03.0\"}"))` which is down to whether the vm is "ready" in `vmm/src/lib.rs` `fn vm_add_pmem`.

Okay so the uid/gid of the rootfs in the container is wrong. I'm running crun as 1000/1000 on the guest and the uid/gid in the runtime config is set for 0/0 so that makes a uidmap/gidmap of 0 1000 1. Very similar to podman but it also maps in a bunch of uids from /etc/subuid to give uids to uid 1+. But now digging into the rootfs, in podman everything is owned 0/0 but on my guest it is 65534 nobody/nogroup. Looking at podman the layers unpacked in `~/.local/share/containers/storage/overlay/*/diff` the uid/gid is 1000! But inside the tar of the actual layer, they are 0/0, so podman must be relabeling on unpack. I think you can also do relabeling on bind or something? Yes [idmappings](https://docs.kernel.org/filesystems/idmappings.html) `mount_setattr` "ID-mapped mounts" and in podman `CreateIDMappedMount`. Though maybe since we'll always be executing as a known 1000 uid we can just do this remapping up front when creating a sqfs of the rootfs (assuming we stick with sqfs). todo confirm theory about how podman is doing the remapping by looking at what uid is on var/cache/apt/archives/partial which has uid 42 (user `_apt`). Update: wrote a blog post about this and right now going with offsetting everything in the sqfs id table by 1000 and always using user 1000 in the proc

Slightly changed the way stdin works so its a bit asymmetric with stdout/stderr. The way those work right now is we always capture like `crun -v /run/output/dir:/run/pe/output ... > /run/output/stdout 2> /run/output/stderr` (note crun doesn't take volume mounts like that but same effect). And then we send back the archive of `/run/output` so user's files always go under `dir/` (could use a better name). Initially stdin was working this way but we can't really rely on the archive coming in having a `stdin, dir/` structure so instead stdin can be optionally specified as a name of a file in the archive. So we unpack whatever into `/run/input` and then (if it exists and isn't a traversal attack) use `/run/input/$stdin`. Altogether that looks like:

```bash
pearchive unpack incoming.ar /run/input
crun -v /run/output/dir:/run/pe/output ... \
    <  /run/input/$stdin \
    >  /run/output/stdout \
    2> /run/output/stderr
pearchive pack /run/output outgoing.ar
```

I discovered that cloud-hypervisor currently does a vmm shutdown on acpi guest shutdown, so we can't reuse the vmm process when the guest shuts down. This is change-able in the future, but for now, it eliminates any benefit of using the api so I'm going to stick with exec'ing 1 vmm process per guest. And the init doesn't have to inotify for the pmem, since they will definitely be there from boot-time.

I have moved very slowly through writing the web/api server. First trying to do a low level epoll only sans-async version in Rust and then using tokio with async. I didn't really like either of them. I haven't yet tried any of the rust frameworks but the thing I can't figure out for sure is whether/how I can use `splice` for the request body. And I can't figure that out because they are so generic over the request body type and stuff that I just nope out, for better or worse. So my next draft will be in go which I don't love but I think has the things I want, which includes things like setting timeouts per phase of the request lifecycle. I really don't want to rewrite the server logic in go so I think I'm going to have go spin up N worker processes in rust and send them work items on a unix socket. On the go side I'll put the sockets in a channel and goroutines can grab one from that channel and use it exclusively. This is going fine, but now I'm already at the point of "may as well have that be a true load balancer and support remote workers". I evaluated cloudflare's pingora and it seems promising, the servehttp is a single function trait for a basic non-streaming http server, so that is at least nice. And then I could write the routing info for arch in a proxy. One thing I'm probably getting way too focused on is `splice` to save the copies, but tls really screws that up anyways. I'm also at this indecision between having the workers make ready requests to the LB and have the match-making thing or go with a more standard backend server. I kinda liked the idea of having all the workers only contact the LB over wireguard and use http 1.1. One thing that plays into is that we need to decide how many connections to use between the LB and worker for an N guest machine. We could have 1 connection serve all N guests, N connections, or > N connections. Remember that the ideal is to have 3 tasks happening for each guest: receiving our next request(s), running our current request, sending our results. We don't want to tie the running of a guest to the network of a single client. And ideally avoid head of line blocking for either sending/receiving. Whether we use 1 or N connections with http 1.1, we will have head of line blocking. This makes me think kN connections is better and have a single task on the guest that reads complete requests, puts them in a file (TODO with a custom frontend to cloudhypervisor and some patches we should be able to mount pmem from a memory range and skip the file (though again the file is almost better if we use splice to receive)) and then enters the run queue. Ideally, we'd have a mechanism to notify the worker of a canceled request like client left or cancel button in the ui, but that now has to get propagated to the worker and if the file is already in the queue, we have to mark it as skip. I'm not finding whether/how a closed connection is propagated in eg pingora. Anyways, for the number of connections, it seems like h2 is actually the better fit. We should punt on the wireguard thing, can be supported later. Everyone deals with tls and they seem to be fine. Do h2 mtls between lb and worker. Worker pool needs a slight adjustment to fit into the async request handler of pingora, I think we just need to pass a oneshot channel onto the queue so the worker knows where to send the result. Big todo: how to best track and bound the total request size in transit between the lb and worker. Oh and the other major api besides `run` is `get-images` to return all the supported images so far. I guess in pingora this would be a background service that asks the workers what images they have. Okay let's try pingora, 4th times a charm.

Idea for the future: have a mode where you can write commands to fd 3 and when you do, we interpret them as commands to run drgn against /proc/kcore and snapshot a "frame" of execution state. Then send the results back to the browser to step through and/or visualize. Example: visualize the data structures involved in various steps of setting up an epoll. drgn looks cool.

# some random benchmarking

fedora 39, 5950x, ddr4 2666 MT/s (dmidecode)

```
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

## on bare system

```
taskset -c 0 ./hyperfine-v1.18.0-x86_64-unknown-linux-gnu/hyperfine --shell=none --warmup=500  'gcc --version'
# 645.2 us +- 26.5 us
```

## from inside toolbox container

```
hyperfine --warmup=5 --runs=1000 --shell=none "gcc --version"
# 2.3 ± 0.4 ms
```

## launching container w/ podman

```
hyperfine --warmup=5 --min-runs=100 --shell=none "podman run --rm --network=none gcc:14.1.0 gcc --version"
# 291.2 ± 70.3 ms
```

## launching container w/ containerd and nerdctl

```
wget https://github.com/containerd/nerdctl/releases/download/v1.7.6/nerdctl-full-1.7.6-linux-amd64.tar.gz
wget https://github.com/containerd/containerd/releases/download/v1.7.18/containerd-1.7.18-linux-amd64.tar.gz
./hyperfine --warmup=5 --shell=none 'sudo ./nerdctl run --rm --network=none gcc:14.1.0 gcc --version
# 400.5 ± 18.5 ms
```

## kata

```
# kata installed from dnf kata-containers, but doesn't include the kernel and initrd? so downloaded those from
wget https://github.com/kata-containers/kata-containers/releases/download/3.6.0/kata-static-3.6.0-amd64.tar.xz
→ sudo ln -s $(readlink -f ~/Downloads/kata-static-3.6.0-amd64/kata/share/kata-containers/kata-containers-initrd.img) /var/cache/kata-containers/kata-containers-initrd.img
→ sudo ln -s $(readlink -f ~/Downloads/kata-static-3.6.0-amd64/kata/share/kata-containers/vmlinuz.container) /var/cache/kata-containers/vmlinuz.container
→ sudo ./nerdctl run --runtime io.containerd.kata.v2 --rm --network=none gcc:14.1.0 gcc --version
# 781.2 ± 29.6 ms

getting error
ERRO[2024-07-01T16:50:07.583883505-05:00] failed to delete cmd="/usr/bin/containerd-shim-kata-v2 -namespace default -address /run/containerd/containerd.sock -publish-binary /var/home/andrew/Repos/program-explorer/bin/containerd -id bdf1493220ed78c326374b7f0a872520c5925b8b2aefbec66c2ccf4247674c1c -bundle /run/containerd/io.containerd.runtime.v2.task/default/bdf1493220ed78c326374b7f0a872520c5925b8b2aefbec66c2ccf4247674c1c delete" error="exit status 1" namespace=default
```

## Singularity (inside a container)

```
# TODO idk what a good base image is
FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && \
    apt-get install -y wget \
                       cryptsetup \
                       libfuse-dev \
                       squashfs-tools \
                       uidmap \
                       fuse \
                       fuse2fs \
                       crun \
    && \
    wget -O /tmp/singularity.deb https://github.com/sylabs/singularity/releases/download/v4.1.3/singularity-ce_4.1.3-noble_amd64.deb && \
    dpkg -i /tmp/singularity.deb && \
    apt-get remove -y wget && \
    apt-get clean && \
    rm -f /tmp/singularity.deb

# TODO somehow this all pulls in libjpeg of all things, how is that even right?

WORKDIR /root
RUN singularity build gcc14.sif docker://gcc:14.1.0

# need to run with --privileged for fuse mount to work
# podman build -t singularitycontainer -f singularitycontainerfile
# podman run --rm -it --privileged localhost/singularitycontainer

# hyperfine --warmup=5 --runs=1000 --shell=none "singularity exec --network none  gcc14.sif /usr/local/bin/gcc --version"
# 73.4 ± 1.0 ms
```

## qemu fedora cloud base generic manually install gcc (without boot obv)

```
virt-customize -a ~/Downloads/Fedora-Cloud-Base-Generic.x86_64-40-1.14.qcow2 --root-password password:hello
qemu-system-x86_64 -smp 2 -enable-kvm -m 2048 -drive file=~/Downloads/Fedora-Cloud-Base-Generic.x86_64-40-1.14.qcow2

# 0.5ms +- 1ms lol wtf
# with -smp 4 vcpus and taskset -c 0, getting
# 0.5ms +- 0.25ms
```

## qemu fedora cloud base microvm time to boot and shutdown gracefully

just building up examples to get there, 7s is obviously too much

```
→ virt-cat fedora-cloud-base.raw /etc/systemd/system/myboot.service
[Unit]
Description=My boot service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/boot.sh
StandardOutput=journal+console

[Install]
WantedBy=multi-user.target

→ virt-cat fedora-cloud-base.raw /usr/local/bin/boot.sh
#!/usr/bin/bash

echo "HII"
shutdown now

qemu-system-x86_64 \
    -M microvm,x-option-roms=off,pit=off,pic=off,isa-serial=off,rtc=off \
    -nodefaults -no-user-config -nographic \
    -enable-kvm \
    -cpu host -smp 4 -m 1G \
    -kernel vmlinuz-6.8.5-301.fc40.x86_64 -append "root=/dev/vda4 console=hvc0 rootflags=subvol=root" \
    -initrd initramfs-6.8.5-301.fc40.x86_64.img \
    -device virtio-blk-device,drive=test \
    -drive id=test,file=fedora-cloud-base.raw,format=raw,if=none \
    -chardev stdio,id=virtiocon0 \
    -device virtio-serial-device \
    -device virtconsole,chardev=virtiocon0

# 6.719 +- 0.236s
```

## qemu microvm using kata container kernel and initrd wip

```
# https://github.com/kata-containers/kata-containers/releases/download/3.6.0/kata-static-3.6.0-amd64.tar.xz
d=$(realpath ~/Downloads/kata-static-3.6.0-amd64/kata/share/kata-containers)

# boots very fast!
# kernel is 43M
# initrd is 15M

qemu-system-x86_64 \
    -M microvm,pit=off,pic=off,isa-serial=off,rtc=off \
    -nodefaults -no-user-config -nographic \
    -enable-kvm \
    -cpu host -smp 4 -m 1G \
    -kernel $d/vmlinux-6.1.62-132 -append "console=hvc0" \
    -initrd $d/kata-alpine-3.18.initrd \
    -chardev stdio,id=virtiocon0 \
    -device virtio-serial-device \
    -device virtconsole,chardev=virtiocon0

# shows boot output then some json lines messages from the kata agent
# you can poke around in here with rdinit=/bin/bash kernel arg
```

Maybe this is dumb but how does this work without a rootfs? It just runs from the initrd?

## cloud hypervisor to custom initramfs (minimal boot)

```
#!/bin/busybox sh

export PATH=/bin

busybox ls -l /

echo 'hi'
busybox poweroff -f
```

```
# based on linux/usr/gen_init_cpio
# make with ~/Repos/linux/usr/gen_init_cpio initattempt1 > init1.initramfs
# cpio -t < init1.initramfs

# A simple initramfs
dir /dev 0755 0 0
nod /dev/console 0600 0 0 c 5 1
dir /root 0700 0 0
dir /sbin 0755 0 0
dir /bin 0755 0 0
file /bin/busybox busybox 0755 0 0
file /init myinit 0755 0 0
```

```
./cloud-hypervisor-static \
    --kernel /home/andrew/Repos/linux/vmlinux \
    --initramfs init1.initramfs \
    --cmdline "console=hvc0" \
    --cpus boot=1 \
    --memory size=1024M
```

```
127.3 +- 5.4 ms
```

## cloud hypervisor to custom initramfs running gcc with --no-pivot

```
#!/bin/busybox sh

export PATH=/bin

# otherwise we get a kernel panic and the vmm process hangs
trap "busybox poweroff -f" EXIT

# crun needs /proc/self/exe for stuff, cgroup_root for containers, and devtmpfs for mounting our sqfs
busybox mount -t proc none /proc
busybox mount -t cgroup2 none /sys/fs/cgroup
busybox mount -t devtmpfs none /dev

busybox mkdir -p /mnt/bundle/rootfs
busybox mount -t squashfs -o loop /dev/vda /mnt/bundle/rootfs

# the config.json is whatever crun spec creates with args changed to gcc --version
busybox mv /config.json /mnt/bundle/config.json

# TODO this is apparently insecure but pivot_root doesn't play nicely with initramfs for todo reason
# related https://github.com/containers/bubblewrap/issues/592
crun run --no-pivot --bundle /mnt/bundle containerid-1234
```

```
# make with ~/Repos/linux/usr/gen_init_cpio initattempt1 > init1.initramfs

dir /dev 0755 0 0
dir /proc 0755 0 0
dir /sys 0755 0 0
dir /sys/fs 0755 0 0
dir /sys/fs/cgroup 0755 0 0
dir /root 0700 0 0
dir /sbin 0755 0 0
dir /bin 0755 0 0

nod /dev/console 0600 0 0 c 5 1

file /bin/busybox busybox 0755 0 0
file /init myinit 0755 0 0
file /bin/crun crun-1.15-linux-amd64 0755 0 0
file /config.json config.json 0444 0 0
```

```
# make sqfs from container
# id=$(podman create docker.io/library/gcc/:14.1.0)
# podman export "$id" | sqfstar gcc-squashfs.sqfs
# podman rm "$id"

# todo the disk id doesn't show up in the guest
# also --disk isn't supported multiple times so I hope initramfs can work out
# kernel needs CONFIG_MISC_FILESYSTEMS=y CONFIG_SQUASHFS=y
./cloud-hypervisor-static \
    --kernel /home/andrew/Repos/linux/vmlinux \
    --initramfs init1.initramfs \
    --cmdline "console=hvc0" \
    --disk path=gcc-squashfs.sqfs,readonly=on,id=container-bundle-squashfs \
    --cpus boot=1 \
    --memory size=1024M
```

```
163.5 +- 7.8 ms was time to actually run gcc --version
```

## cloud hypervisor to custom initramfs running gcc

happened across [this comment](https://github.com/containers/bubblewrap/issues/592#issuecomment-2243087731) with very good timing! solved the `pivot_root` error so don't need --no-pivot

update: wrote a [small wrapper](https://gist.github.com/aconz2/3d5bd92b4027ccef11db8215878f7112) to avoid the shell chain so you can just do `parent_rootfs /abc crun ...`

experimented a bit with `--pmem file=gcc.sqfs,discard_writes=on` (though note that file has to be multiple of 2M, zero padding the sqfs seemed to work) and then you mount `/dev/pmem0`. Is a tiny bit faster for something like `find /mnt/bundle/rootfs > /dev/null`

want to test later with erofs vs sqfs

```
#!/bin/busybox sh

export PATH=/bin

# otherwise we get a kernel panic and the vmm process hangs
trap "busybox poweroff -f" EXIT

# crun needs /proc/self/exe for stuff, cgroup_root for containers, and devtmpfs for mounting our sqfs
busybox mount -t proc none /proc
busybox mount -t cgroup2 none /sys/fs/cgroup
busybox mount -t devtmpfs none /dev

busybox mkdir -p /mnt/bundle/rootfs
busybox mount -t squashfs -o loop /dev/vda /mnt/bundle/rootfs

# the config.json is whatever crun spec creates with args changed to gcc --version
busybox mv /config.json /mnt/bundle/config.json

busybox unshare --mount /bin/init2
```

init2

```
#!/bin/busybox sh

busybox mkdir /abc
busybox mount --rbind / /abc
cd /abc
busybox mount --move . /
exec busybox chroot . /bin/init3
```

init3

```
#!/bin/busybox sh

exec crun run --bundle /mnt/bundle containerid-1234
```

```
# make with ~/Repos/linux/usr/gen_init_cpio initattempt1 > init1.initramfs

dir /dev 0755 0 0
dir /proc 0755 0 0
dir /sys 0755 0 0
dir /sys/fs 0755 0 0
dir /sys/fs/cgroup 0755 0 0
dir /root 0700 0 0
dir /sbin 0755 0 0
dir /bin 0755 0 0
dir /tmp 0755 0 0

nod /dev/console 0600 0 0 c 5 1

file /bin/busybox busybox 0755 0 0
file /init myinit 0755 0 0
file /bin/init2 init2 0755 0 0
file /bin/init3 init3 0755 0 0
file /bin/crun crun-1.15-linux-amd64 0755 0 0
file /config.json config.json 0444 0 0
```

```
# make sqfs from container
# id=$(podman create docker.io/library/gcc/:14.1.0)
# podman export "$id" | sqfstar gcc-squashfs.sqfs
# podman rm "$id"

./cloud-hypervisor-static \
    --kernel /home/andrew/Repos/linux/vmlinux \
    --initramfs init1.initramfs \
    --cmdline "console=hvc0" \
    --disk path=gcc-squashfs.sqfs,readonly=on,id=container-bundle-squashfs \
    --cpus boot=1 \
    --memory size=1024M
```

```
166.8 +- 5.0 ms
130 +- 5 ms with --console off
116.8 +- 4.7 ms with --console off kernel 6.2 and config from cloud-hypervisor and zstd squashfs
```

## firecracker

todo
