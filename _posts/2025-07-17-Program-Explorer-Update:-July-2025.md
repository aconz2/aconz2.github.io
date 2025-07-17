---
layout: post
title:  "Program Explorer Update: July 2025"
date:   2025-07-17
categories:
---

In case you're not familiar, Program Explorer [programexplorer.org](https://programexplorer.org) is a project I started nearly a year ago with the goal of having a website to quickly run programs from container images in the browser. The name is a homage to [Compiler Explorer](https://godbolt.org) which has been a big source of inspiration. The codebase is open source at [https://github.com/aconz2/program-explorer]().

## Load from Github gist

The main new user facing feature this month is the ability to load a set of files and PE configuration from a github gist id. The link format looks like `https://programexplorer.org/#gist=<id>` which will then fetch that gist and populate the editor with those files. It also looks for a special file named `pe.toml` which lets you configure things like the container image, command, env, and stdin. An example: [https://programexplorer.org/#gist=f99477cc99cd1e7a4c043f805c2297e6]() loads [this gist](https://gist.github.com/aconz2/f99477cc99cd1e7a4c043f805c2297e6).

One thing that is mostly implemented is to also specify which revision/version of a gist you want to link to; that makes the links much more permanent, while also leaving the breadcrumb to try out whatever future versions the gist there are. Unfortunately as far as I can find, the revision of a gist is not so easily available in their UI anywhere. It is returned in the API and I'm passing that along to the frontend so that in the future you can pick the revision and get a link like `https://programexplorer.org/#gist=<id>/<revision>`.

I'm not sure whether to stick with the hash `/#gist=<id>` format or use something like `/_/gist/<id>`. And the `pe.toml` format likely needs some more specification thoughts but for now it is a few string fields. A nice to have would be a "create gist" button that took the current files and settings and would create a gist for you if you are logged into Github.

## Big Container Images

One thing I've been wanting to do is turn the Compiler Explorer builds into container images. That would reuse their efforts in building so many versions of compilers but make them easily available both to run locally and in PE. They publish tarballs of their builds to a public s3 which can be built into a container image semi-easily with something like:

```
# tar -xf clang-20.1.0.tar.xz
FROM ubuntu:22.04
# need to provide libstdc++ libc libm libz
RUN apt update -y && apt install -y gcc g++
# copy into /usr because /bin and /lib etc are symlinks and copy would replace it with the dir, but we want a merge
COPY clang-20.1.0 /usr  # the tarball has everything in a leading dir clang-20.1.0
```

Especially for clang which contains with all the LLVM tools, these are on the order of 5-6 GB. This build process takes some time because of the unpacking and repacking into tarballs. I was tempted to write a dedicated tool to build the container image directly by rewriting the tarball leading component to `/usr`. Maybe worth it, probably not right now.

Anyways, this lead me down some more thinking because if I were to build these container images, push them to a registry, and have people run them from PE, I'm worried about supporting that size of image. I have a current limit of 3 GB unpacked for images since these take disk space and maybe more importantly, download time, bandwidth, and conversion time. I feel like I'm hitting all the same points that lead to the nydus image service where their next move was to support loading erofs from a container registry stored as an artifact. That also kinda requires signing the images since a malicious erofs loaded into the kernel might do bad things; though this would be in the VM so not sure how to quantify that threat. Another thing they have is split metadata and data where one erofs file contains all the inodes (possibly with inline data for small files) and then one or more erofs images with the real data. This is nice because metadata is small and all of the initial stat, open etc calls in startup go fast and then you can load the other stuff as needed. And that combined with the data erofs images living over network means you can download parts of the file on demand (see next section).

## Virtio User Block

So one road I started down to support large container images that have been converted to erofs images and stored in s3-like storage is dubbed [pevub](https://github.com/aconz2/program-explorer/blob/82f5f7af9c6601b5d02450153a8df7dccd370d48/pevub/src/main.rs) for Program explorer virtio user block. This would be a program that would get spawned along with the cloud-hypervisor process that receives block device reads from the guest and would then get the data from s3 (with chunk caching). Thankfully there's a library to handle the vring (memory mapped ring buffer shared between your process and the guest kernel) and notifications (eventfd shared with the guest kernel) and some overall framework (for a generic virtio user process). I got the skeleton working but it currently responds to all read requests with 42 for every byte. One friction point is that `VhostUserBackendMut` uses epoll everywhere and not async. Wiring up a simple s3 client for GET's shouldn't be too bad but I started to feel like this wasn't the right thing to be working on so I paused. I also was never positive how to best do caching: I wanted to cache something like 1 MB blocks of a file so that the most used parts of each 5 GB container would normally be on local disk. There are some thoughts in comment in the code on what I was thinking.

This also made me test the read latency for 1-2 MB sections of a file from s3 on OVH and what I have written down was 47 ms on standard tier and 24 ms on fast tier. Especially when my current wall clock limit is 1s, that is too slow; a few cache misses and you don't get to do very much. I guess this is where oversubscribing the CPU is beneficial since you can just swap to another task while you wait. I have deliberately avoided that for security reasons but is maybe something to reconsider.

## Snapshotting

I investigated starting the guest VM from a snapshot to improve startup time (currently on the order 100 ms) but things didn't pan out. What I found with cloud-hypervisor default snapshotting is that the whole memory is saved to a file on snapshot and the whole file is read on restore. For 1 GB memory, this takes some time. I then tried a trickier approach where I started the guest with low memory (128 MB minimum), snapshotted, restored, resized memory (with ro mmap), then resumed. This is in [snapshot-test.rs](https://github.com/aconz2/program-explorer/blob/82f5f7af9c6601b5d02450153a8df7dccd370d48/perunner/src/snapshot-test.rs). And it is mildly better but adds complexity.

Another aspect that I never figured out a great approach to is the coordination between the guest init process saying "I'm ready for a snapshot" and then entering a state where it is waiting to be resumed. In the above code, I am using a vsock that the guest writes to when ready, then blocks on reading the vsock. On resume, we remove the vsock entirely and this interrupts the `read` which the init process is expecting and then it continues running. This is in the code [here](https://github.com/aconz2/program-explorer/blob/82f5f7af9c6601b5d02450153a8df7dccd370d48/peinit/src/main.rs#L304). Having this vsock is a bit annoying and I think there were some more complications around cloud-hypervisor saving the full path of the vsock on the host side so that restoring multiple guests from a single snapshot might conflict. And with taking the snapshot data from a dir so that multiple restores end up conflicting (eg by using the same vsock path). I do meddle with the snapshot `config.json` to do the memory stuff above so maybe the same could be applied for this problem.

So far this didn't seem promising so also shelved.

## Erofs compression

I made progress an my erofs implementation [peeros](https://github.com/aconz2/program-explorer/blob/82f5f7af9c6601b5d02450153a8df7dccd370d48/peerofs/src/disk.rs) and it can now read lz4 compressed data with the `CompressedFull` (`EROFS_INODE_COMPRESSED_FULL`) legacy layout. This is the first and simpler version of how compression is implemented in erofs and the `CompressedCompact` (`EROFS_INODE_COMPRESSED_COMPACT`) continues to confuse me, but I think doing the simpler version has given me a better understanding of what is going on. I worked on this partly for fun and partly for "support bigger container images". Since I paused on the latter I haven't added the ability to build images with compression, but that will happen at some point.

## Next

Now with gist link support, I want to get a collection of examples going of cool and interesting demos.
