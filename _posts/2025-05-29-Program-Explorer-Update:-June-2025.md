---
layout: post
title:  "Program Explorer Update: June 2025"
date:   2025-05-30
categories:
---

In case you're not familiar, Program Explorer [programexplorer.org](https://programexplorer.org) is a project I started nearly a year ago with the goal of having a website to quickly run programs from container images in the browser. The name is a homage to [Compiler Explorer](https://godbolt.org) which has been a big source of inspiration. The codebase is open source at [https://github.com/aconz2/program-explorer]().

In March 2025 I [announced](https://news.ycombinator.com/item?id=43334192) the website where you could choose a container from a preset list, customize the command and input files, and get the results back in your browser. This was a big step for me because it was a big chunk of work to get to an MVP and I knew shipping something that wasn't perfect and feature complete was going to be hard. But eventually I found an okay state of things, rented a server, and got everything deployed.

One major limitation from the initial release was that I had to manually package the container image into a single [erofs](https://erofs.docs.kernel.org/en/latest/) image and upload it to the server. Why a single erofs image? This is because each program is run in a VM and we can easily mount a single erofs image into the VM which then gets mounted as the rootfs for the container. There are other ways to do this but I like this one right now. To produce the erofs image, we have to do two things: 1) download the layers 2) flatten the layers 3) build the erofs image.

## Download the layers

Getting the layers from a container registry is easy using skopeo, podman, docker, etc. or in my original [peimage](https://github.com/aconz2/program-explorer/blob/main/peimage/peimage.go) tool, I was using the Google go container library.

## Flatten the layers

An OCI container layer is a tar file that represents a diff of a filesystem: files/directories can be added, removed, and modified. When flattening layers into a single image, we have to keep track of the diff'ing operations of each layer and produce a single image with the right files. One way to do this is `id=$(podman create busybox) && podman export $id`, easy right? Well what that does is: download any layer blobs that aren't present, unpack the layers (if not already) into a directory on the host system while taking care to translate deletions in the layer into overlayfs whiteouts, mount an overlayfs on the host using those unpacked directories, walk the the overlayfs dir and export it to a tar stream. Wouldn't it be nice if we could do this without unpacking and mounting the overlayfs? Well sylabs (of singularity containers) thought so too and wrote [squash.go](https://github.com/sylabs/oci-tools/blob/main/pkg/mutate/squash.go) that squashes the layers of a container taking in each layer as a tar stream and outputting a tar stream. Nice! I used that in my original peimage tool. Note that my tool also does some transforms to the stream like incrementing all uid/gid by 1000 because the container runs as uid 1000 mapped to 0 and we want to preserve the apparent uid in the container. Also, that tool can pack multiple container images into a single tar stream, with each image getting a unique prefix. This was maybe a bit of unnecessary complexity but seemed appealing because erofs supports content deduplication where if we packed 4 container images that all shared the same base layer, the contents of that base layer would only get stored once.

## Build an erofs image

To build an erofs image, I was using `mkfs.erofs --tar=f img.erofs fifo` from [erofs-utils](https://github.com/erofs/erofs-utils) and that worked okay, but I wasn't happy with it.

## Reimplement each step

In order to support running any container by URL (or technically by "reference" though even that is overloaded in the OCI spec) on Program Explorer, I needed to be able to build these erofs images on demand. And especially since I'm on a single server right now, I wanted it to be efficient. And the more I thought about each step, the more I wanted full control over each one, so I ended up reimplementing each step.

Starting with layer flattening, I wrote [peimage/src/squash.rs](https://github.com/aconz2/program-explorer/blob/main/peimage/src/squash.rs) which I think makes some improvements over the sylabs version though I'm potentially still not handling every hardlink edge case (issue reports welcome!). It also benefits from using libz-ng because benchmarking shows roughly 75% of CPU time is spent in inflating/decoding the gzip tarball.

Then I moved on to the challenge of building erofs images in [peerofs/src/build.rs](https://github.com/aconz2/program-explorer/blob/main/peerofs/src/build.rs). This took a while and I only implemented the bare minimum of what I needed but totally works (also some hardlink edge cases not 100% handled). I think this makes improvements over `mkfs.erofs` for what I need, specifically around what to do with file data as it comes in (you don't want to buffer it in memory); my tool writes in the beginning of the file, while `mkfs.erofs` writes it to the end after a hole and then does a copy (though I think this copy is a metadata update for the kernel instead of a whole copy, but still less copies more better).

And then finally I wrote an OCI registry client in [peoci/src/ocidist.rs & ocidist_cache.rs](https://github.com/aconz2/program-explorer/blob/main/peoci/src/ocidist.rs) to fetch the manifests and layers and all that jazz.

I have a fixed size caching layer for 1) references (like a `latest` tag) to manifest digests 2) manifests by digest 3) blobs by layer digest. I used the [moka](https://github.com/moka-rs/moka) caching library to implement these caches and that was a pretty nice experience. The nice thing about these caching layers is that concurrent reads for a cache miss will only execute one fetch so we don't duplicate work. The only weird thing that is a minor annoyance is having `Result<V, Arc<E>>` but that's fine. Blobs get stored as individual files and are returned as `OwnedFd` so that there is no race with a blob delete if the cache exceeds capacity and that blob were to get deleted. So it is possible for the disk usage to temporarily exceed the max cache size, but I haven't put more effort into further bounding this. Cached references (like `latest`) are not currently expired so they will last forever, but I think moving to expiring them at midnight UTC would be a good thing. The actual manifest digest that was run is returned in the API response but not currently in the UI (check the dev tools console).

## peimage-service

Finally, I put these pieces together into [peimage-service](https://github.com/aconz2/program-explorer/blob/main/peimage-service/src/main.rs) which also uses moka cache for erofs images and stores them as files on disk. It communicates over a unix domain socket and sends the image as a file descriptor so that there is no race with deletions as per blobs. I revamped the subprocess call into cloud-hypervisor to take this image by fd (though it still gets passed as a path to `/dev/fd/{fdno}` which I might like to contribute an option for `fd={fdno}` like there is for the api socket but the `PmemConfig` is used in the API interface so not sure how that would go) so that the image can never disappear unexpectedly. This also keeps the network access to the container registry isolated from the worker process which currently runs with `--network=none`.

### Aside: where to deduplicate/compress?

One aspect that I don't see a clear answer to is what layer (if any) to do compression and/or content deduplication. With image layers by hash, registries are probably saving storage space, though I would really love if they could publish some data on layer sizes, reuse counts, and access frequency. Most layers (again would love some stats from the registries!) are stored as gzip. For Program Explorer, it might be beneficial to re-encode these layers on download to use something like zstd or lz4 because as mentioned above, a significant amount of CPU time is spent decoding gzip, but this only makes sense if cached layers will get reused enough. For the erofs images, they are not using any compression which trades off disk space for CPU time in construction. If layers were stored uncompressed, we could use `sendfile` to directly copy the file from the tar stream into the erofs file which would be nice. And that could also be used with filesystem compression like lz4 if using BTRFS for example. And the tradeoffs in erofs file compression are unclear to me as well; I know there is some potential for net savings on spinning disks (of which my server currently has) when using lz4. My `peerofs` implementation can neither read nor write compressed erofs images currently because the compressed format is very unclear to me and I'm happy enough with uncompressed images. Another route is to convert each layer into an erofs image, then mount an overflayfs in the VM, but this requires mounting in 1 device per layer and then you pay a lookup tax. I think once you run a container image more than once you're better off having flattened it into a single image. I guess the usecase where you're running tens of containers (probably services) on a single server that share some base layer does get you savings, but Program Explorer is focused on batch computations right now so you'll have at most 1 container per core.

## Now go and use it

Please go try running your favorite container image (currently up to 2GB compressed / 3GB uncompressed) from docker or ghcr at [programexplorer.org](https://programexplorer.org)! Right now I'm using free registry plans so it is easily possible to get rate limited by the registry.

Feedback welcome by email or at [aconz2/program-explorer/discussions](https://github.com/aconz2/program-explorer/discussions).

The website/frontend is still pretty basic and especially if you request a new container image that takes some time to download and create, it will just sit there without much feedback. You can always look at the dev tools console and network for more information.
