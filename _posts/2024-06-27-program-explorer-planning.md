---
layout: post
title:  "Program Explorer Planning"
date:   2024-06-27
categories:
---

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

# some random benchmarking

fedora 39, 5950x

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

## cloud hypervisor to custom initramfs (minimal boot)

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

## firecracker

todo
