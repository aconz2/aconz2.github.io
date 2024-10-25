---
layout: post
title:  "OCI Container Image Whiteouts"
date:   2024-10-25
categories:
---

OCI container images are made of layers, with the current storage/transport standard for a layer being a tar file. From inside the container, the running process should see the "union" of all the layers such that:

* files in upper layers take precedence over lower layers
* files and directories in lower layers that are then deleted in higher layers should not be present

Tar was not created with a way to store a file that says "this file/dir has been deleted". The OCI spec inherited the method of AUFS by putting a deleted dir/file into a tar archive as a zero length file with a `.wh.` prefix on the filename. Let's see them in action (remember that each `RUN` statement in a containerfile will create a layer):

```bash
mkdir -p /tmp/article
cd /tmp/article
cat << "EOF" > Containerfile
FROM docker.io/library/busybox@sha256:22f27168517de1f58dae0ad51eacf1527e7e7ccc47512d3946f56bdbe913f564
RUN mkdir x y z && touch x/a y/a y/b y/c z/a z/b z/c
RUN rm x/a
RUN rm -r y
RUN rm -r z/ && mkdir z
EOF
podman build -f Containerfile -t article-testing:1 >/dev/null
podman build --dns=none --no-hosts --no-hostname -f Containerfile -t article-testing:no-etc >/dev/null
podman image ls article-testing
```

```
REPOSITORY                 TAG         IMAGE ID      CREATED      SIZE
localhost/article-testing  no-etc      f9ad545d7c1c  2 hours ago  4.53 MB
localhost/article-testing  1           f9ad545d7c1c  2 hours ago  4.53 MB
```

```bash
cd /tmp/article
rm -rf oci-1 oci-no-etc
skopeo copy containers-storage:localhost/article-testing:1 oci:oci-1 > /dev/null
skopeo copy containers-storage:localhost/article-testing:no-etc oci:oci-no-etc >/dev/null
ls oci-1
```

```
blobs
index.json
oci-layout
```

Here I'm using a little script called [inspecttar.py](https://gist.github.com/aconz2/8c3cb86a29cb2b08a61647ce418330fd) that dumps out each layer of the tar. We mostly skip the first since it is boring (though note that the first line is a dir of `.`!)

```bash
cd /tmp/article
# send stderr to null since we get a broken pipe
inspecttar.py --layer 0 oci-1/index.json 2>/dev/null | head -n10
echo ...
for i in {1..4}; do
    # trim off some useless info so the filenames don't go too wide
    inspecttar.py --layer $i oci-1/index.json | sed -e 's_uid/gid.\+{}__' -e 's_size= \+0__'
done
```

```
-- layer 0 sha256:a77743c2174af437de8b6d59e4761b45a3761b332bcbbeeb1e0b4af6aa37d1c2
oci-1/blobs/sha256/a77743c2174af437de8b6d59e4761b45a3761b332bcbbeeb1e0b4af6aa37d1c2: format=PAX_FORMAT
layer=0 size=         0 mtime=1727386302 mode=000755 type=DIRTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} . 
layer=0 size=         0 mtime=1727386302 mode=000755 type=DIRTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} bin 
layer=0 size=   1029688 mtime=1727386302 mode=000755 type=REGTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} bin/[ 
layer=0 size=         0 mtime=1727386302 mode=000755 type=LNKTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} bin/[[ 
layer=0 size=         0 mtime=1727386302 mode=000755 type=LNKTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} bin/acpid 
layer=0 size=         0 mtime=1727386302 mode=000755 type=LNKTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} bin/add-shell 
layer=0 size=         0 mtime=1727386302 mode=000755 type=LNKTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} bin/addgroup 
layer=0 size=         0 mtime=1727386302 mode=000755 type=LNKTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} bin/adduser 
...
-- layer 1 sha256:d7c583b6274414e2def0073e109a86c0fb823d34a6bb017e9def5cc69a000b28
oci-1/blobs/sha256/d7c583b6274414e2def0073e109a86c0fb823d34a6bb017e9def5cc69a000b28: format=PAX_FORMAT
layer=1  mtime=1729887075 mode=000755 type=DIRTYPE  etc 
layer=1  mtime=1729887075 mode=000700 type=REGTYPE  etc/hostname 
layer=1  mtime=1729887075 mode=000700 type=REGTYPE  etc/hosts 
layer=1  mtime=1729887075 mode=000700 type=REGTYPE  etc/resolv.conf 
layer=1  mtime=1729887075 mode=000755 type=DIRTYPE  proc 
layer=1  mtime=1729887075 mode=000755 type=DIRTYPE  run 
layer=1  mtime=1729887075 mode=000755 type=DIRTYPE  sys 
layer=1  mtime=1729887075 mode=000755 type=DIRTYPE  x 
layer=1  mtime=1729887075 mode=000644 type=REGTYPE  x/a 
layer=1  mtime=1729887075 mode=000755 type=DIRTYPE  y 
layer=1  mtime=1729887075 mode=000644 type=REGTYPE  y/a 
layer=1  mtime=1729887075 mode=000644 type=REGTYPE  y/b 
layer=1  mtime=1729887075 mode=000644 type=REGTYPE  y/c 
layer=1  mtime=1729887075 mode=000755 type=DIRTYPE  z 
layer=1  mtime=1729887075 mode=000644 type=REGTYPE  z/a 
layer=1  mtime=1729887075 mode=000644 type=REGTYPE  z/b 
layer=1  mtime=1729887075 mode=000644 type=REGTYPE  z/c 
-- layer 2 sha256:428b7b8eb4565e0ab87d6c8fac68ca4ae537e46b3fa12c1bf0df38dd9cdf31af
oci-1/blobs/sha256/428b7b8eb4565e0ab87d6c8fac68ca4ae537e46b3fa12c1bf0df38dd9cdf31af: format=PAX_FORMAT
layer=2  mtime=1729887075 mode=000755 type=DIRTYPE  run 
layer=2  mtime=1729887075 mode=000755 type=DIRTYPE  x 
layer=2  mtime=1729887075 mode=000000 type=REGTYPE  x/.wh.a 
-- layer 3 sha256:d0894f8d02021691da8affbc7215accadde00386632f79f79f5a6c3c6e6c0467
oci-1/blobs/sha256/d0894f8d02021691da8affbc7215accadde00386632f79f79f5a6c3c6e6c0467: format=PAX_FORMAT
layer=3  mtime=1729888491 mode=000755 type=DIRTYPE  run 
layer=3  mtime=1729888491 mode=000000 type=REGTYPE  .wh.y 
-- layer 4 sha256:25702a3ae7d343b80e8fc706993612b58a07c576b1ec38525abf3fa92827d6b4
oci-1/blobs/sha256/25702a3ae7d343b80e8fc706993612b58a07c576b1ec38525abf3fa92827d6b4: format=PAX_FORMAT
layer=4  mtime=1729888586 mode=000755 type=DIRTYPE  run 
layer=4  mtime=1729888586 mode=000755 type=DIRTYPE  z 
layer=4  mtime=0 mode=000755 type=REGTYPE  z/.wh..wh..opq 
```

(Note layer numbers are 0 based here)

Okay wow first thing we see is that our layers 1,2,3 all have a `run` dir added to them, that's weird, and layer 1 has `etc` stuff and `proc` and `sys` dirs. This was actually unexpected so I'm glad we're going through this. These are mounts/dirs that podman mounts into the container by default and while we theoretically can get rid of the etc with `--dns=none --no-hosts --no-hostname`, the next thing shows that they are still there... and they are zero sized above and below. Not sure what is going on there. But notice that `run` "has" to be included in each layer because the mtime changes (though it doesn't change between 1 and 2 and it is still there!).

<details>

<summary>etc stuff still there</summary>

```bash
cd /tmp/article
inspecttar.py --layer 1 oci-no-etc/index.json 2>/dev/null | grep etc
echo ...
```

```
oci-no-etc/blobs/sha256/d7c583b6274414e2def0073e109a86c0fb823d34a6bb017e9def5cc69a000b28: format=PAX_FORMAT
layer=1 size=         0 mtime=1729887075 mode=000755 type=DIRTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} etc 
layer=1 size=         0 mtime=1729887075 mode=000700 type=REGTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} etc/hostname 
layer=1 size=         0 mtime=1729887075 mode=000700 type=REGTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} etc/hosts 
layer=1 size=         0 mtime=1729887075 mode=000700 type=REGTYPE uid/gid=0/0 uname/gname=/ dev=0,0 {} etc/resolv.conf 
...
```

</details>

And in layer 2, we see `x/.wh.a` is a whiteout deletion marker file for the file `x/a`. In layer 3 we see `.wh.y` whiteout for the dir `y`.

And in layer 4, we see `z/.wh..wh..opq`, just wtf is that!? Well that is an "opaque" whiteout marker and means that every sibling of that file should be considered deleted in the layers below, or equivalently that the parent of this marker file is an opaque directory. The final `RUN rm -r z && mkdir z` is one of the only things I know of that will cause podman to create one of these ([code here](https://github.com/containers/storage/blob/e636adaf37bdcf3da4129afaf63abc4ee6af622c/pkg/archive/archive_linux.go#L79)). I think the explanation goes like this:

* we're using overlayfs with lowerdirs of the existing layers and we're about to run `RUN rm -r z && mkdir z`
* we run `rm -r z` and (ignoring the files in z) so when we delete `z` (which exists in a lowerdir), linux has to mark the directory as deleted without actually deleting it from the lower layers
  * in linux overlayfs, files are marked deleted with a character device major/minor 0/0 and opaque directories with an xattr trusted.overlay.opaque=y ([docs](https://docs.kernel.org/filesystems/overlayfs.html#whiteouts-and-opaque-directories))
  * but that shows up as user.overlay.opaque in the testing below (some translation is happening)
* after running `rm -r z`, linux marks this directory as deleted with a char dev 0/0
* we then `mkdir z` which is a new directory that also exists in a lowerdir (and also currently as a char dev 0/0) so it has to mark it as an opaque dir so that afterwards when we do `ls z`, it doesn't go looking into the lower layers and incorrectly return `a b c`
* below we see the dir with the xattr marking it as opaque and then when we export it to tar, it gets transformed into the `.wh..wh..opq` file

Remember that lowerdirs are given top down so the first lowerdir is the last layer which is the one we want to inspect

```bash
id=$(podman create article-testing:1)
last_layer=$(podman inspect $id | jq -r '.[0].GraphDriver.Data.LowerDir' | tr ':' '\n' | head -n1)
ls -l $last_layer
getfattr --absolute-names --dump --match '-' -- $last_layer/z
podman rm $id >/dev/null
```

```
total 0
drwxr-xr-x. 1 andrew andrew 0 Oct 25 15:36 run
drwxr-xr-x. 1 andrew andrew 0 Oct 25 15:36 z
# file: /home/andrew/.local/share/containers/storage/overlay/6f42fa9ff634f093c854d3bef9ecf06be1001b52a5863f4957e7a00270cc8cdf/diff/z
security.selinux="unconfined_u:object_r:container_ro_file_t:s0"
user.overlay.opaque="y"

```

Okay so now let's compare two ways of exporting a flattened tar image, podman and google's [crane](https://github.com/google/go-containerregistry/releases):

```bash
cd /tmp/article
id=$(podman create article-testing:1)
podman export $id > article-testing.flat.podman.tar
podman rm $id >/dev/null

if [ ! -f article-testing.docker.tar ]; then
    skopeo copy containers-storage:localhost/article-testing:1 docker-archive:article-testing.docker.tar > /dev/null
fi
crane export - article-testing.flat.crane.tar < article-testing.docker.tar

echo '-- from podman --'
tar tvf article-testing.flat.podman.tar | grep z/
echo

echo '-- from crane --'
tar tvf article-testing.flat.crane.tar | grep z/
```

```
-- from podman --
drwxr-xr-x 0/0               0 2024-10-25 15:36 z/

-- from crane --
-rw-r--r-- 0/0               0 2024-10-25 15:11 z/a
-rw-r--r-- 0/0               0 2024-10-25 15:11 z/b
-rw-r--r-- 0/0               0 2024-10-25 15:11 z/c
```

One of those is not like the other! This is too bad because crane does the exporting directly from tars -> tar whereas podman goes tar -> fs -> overlay -> tar. And I'm not the first to discover this, [this issue](https://github.com/google/go-containerregistry/issues/1897) reported it but it got closed as "not planned" :(.

I was curious so I ran an equivalent test on google cloud, pushing an image that I knew had an opaque whiteout `.wh..wh..opq.` and running it through cloud run and there it does seem to be handled properly, so I guess they're not using that library to handle it.

My next step is to test the [sylabs/oci-tools](https://github.com/sylabs/oci-tools) to do a tars -> tar which I think handles the oci spec properly.

I didn't even try to understand how hardlinks are supposed to work and are the number 1 thing keeping me from even trying to write my own right now; which is probably for the better! Anyways, I think with the sylabs thing I can write a nice little tool which will go from tars -> tar, offset uid/gid by a given amount (1000), and prefix every file with a directory name so that I can throw multiple images into one tar stream with an image index and pipe the whole thing to sqfstar (I did open a PR for offsetting uid in sqfstar [here](https://github.com/plougher/squashfs-tools/pull/291) but I doubt it makes sense to include or will be merged and this is better anyways).

One random thing to end on about tar PAX format is that each file can have key value pairs with more attributes. Xattrs get stored in this with a prefix `SCHILY.xattr.`. What is SCHILY you ask? I found it at the top of the freebsd [man page for star](https://man.freebsd.org/cgi/man.cgi?query=star&sektion=5) as "Schily's user commands" which lead me to [schilytools/schilytools](https://codeberg.org/schilytools/schilytools) "A collection of tools written or formerly managed by Jörg Schilling.". So there you go, its a part of somebody's name. Doing a `git blame star/star.5 | grep SCHILY.xattr` goes back to 2007.

```bash
cd /tmp/article
touch afile
setfattr -n user.myxattr -v value afile
getfattr --dump afile
tar cf afile.tar --xattrs afile
inspecttar.py afile.tar | sed 's_{\|, _\n  _g'  # make the output a bit less wide
```

```
# file: afile
user.myxattr="value"

afile.tar: format=PAX_FORMAT
size=         0 mtime=1729895624.2763104 mode=000644 type=REGTYPE uid/gid=1000/1000 uname/gname=andrew/andrew dev=0,0 
  'mtime': '1729895624.276310491'
  'atime': '1729895624.276310491'
  'ctime': '1729895624.277310492'
  'SCHILY.xattr.user.myxattr': 'value'
  'SCHILY.xattr.security.selinux': 'unconfined_u:object_r:user_tmp_t:s0\x00'} afile 
```

