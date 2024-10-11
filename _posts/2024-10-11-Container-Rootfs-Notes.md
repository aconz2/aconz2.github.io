---
layout: post
title:  "Container Rootfs Notes"
date:   2024-10-11
categories:
---

In working on program explorer, I ran into some things that confused me about uid/gid ownership of files/dirs on the rootfs of a container. Here I try to explain those to myself to better understand them.

The rootfs of a container is the set of all files in the container image, excluding volumes, dirs, or other filesystems which are mounted in at run time. The rootfs is composed of layers which come from the image registry most commonly as tar files.

Our running example will be `gcc:14.1.0` so do a `podman pull docker.io/library/gcc:14.1.0`

We can put all these things in one directory like so:

```bash
if [ ! -d /tmp/gcc14-save ]; then
    podman save -o /tmp/gcc14-save --format oci-dir docker.io/library/gcc:14.1.0
fi
ls /tmp/gcc14-save
```

```
blobs
index.json
oci-layout
```

(Sidenote, sometimes `podman save` also exports the merged tree...)

The important files in this export are `index.json` and `blobs`

```bash
cd /tmp/gcc14-save
jq < oci-layout
sha256sum index.json
jq < index.json
```

```
{
  "imageLayoutVersion": "1.0.0"
}
b9d7a9517fae9525c2e2679930e7b0c611a468762a4788b70f306b6c074b3553  index.json
{
  "schemaVersion": 2,
  "manifests": [
    {
      "mediaType": "application/vnd.oci.image.manifest.v1+json",
      "digest": "sha256:be7992e5d1999dd7e7cead8e59266b2f3671624de0ff31aff9463a6465b963e2",
      "size": 2121,
      "annotations": {
        "org.opencontainers.image.ref.name": "docker.io/library/gcc:14.1.0"
      }
    }
  ]
}
```

We grab the digest from `index.json` and look up the `manifest` in the `blobs` dir. Then the manifest can be used to lookup the image `config` ([docs](https://github.com/opencontainers/image-spec/blob/main/config.md)). Note that the `manifest` lists tar layers which do match those in the `config` layers. This is because the manifest are digests on compressed tar files and the config on uncompressed.

```bash
cd /tmp/gcc14-save
image_manifest=$(jq -r '.manifests[0].digest' index.json | sed 's_:_/_')
echo "image manifest is $image_manifest"
sha256sum blobs/$image_manifest
jq 'del(.annotations)' blobs/$image_manifest

echo

image_config=$(jq -r '.config.digest' blobs/$image_manifest | sed 's_:_/_')
echo "image config is $image_config"
sha256sum blobs/$image_config
jq 'del(.history)' blobs/$image_config

layers_compressed=$(jq -r '.layers[].digest' blobs/$image_manifest | sed 's_:_/_')
# only showing one of these
for layer in $layers_compressed; do
    #swapped out to save processing time while editing
    #digest=$(zcat blobs/$layer | sha256sum)
    digest=f6faf32734e0870d82ea890737958fe33ce9ddfed27b3b157576d2aadbab3322
    first_layer=$(jq -r '.rootfs.diff_ids[0]' blobs/$image_config)
    echo "The layer from the manifest is $layer and decompresses to the config layer $digest"
    echo "This should equal $first_layer"
    break
done
```

```
image manifest is sha256/be7992e5d1999dd7e7cead8e59266b2f3671624de0ff31aff9463a6465b963e2
be7992e5d1999dd7e7cead8e59266b2f3671624de0ff31aff9463a6465b963e2  blobs/sha256/be7992e5d1999dd7e7cead8e59266b2f3671624de0ff31aff9463a6465b963e2
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "config": {
    "mediaType": "application/vnd.oci.image.config.v1+json",
    "digest": "sha256:339722f412f60e6c1f0397272dbf359041ca6facae6f8982852e5c9ceb18ec72",
    "size": 7304
  },
  "layers": [
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:7ca350407cbfcb9d25b667d38417c1706bbf0feb3fd92fd8449e8c07bc0edc1c",
      "size": 51066807
    },
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:7c2ab4a0736c98021c500f512a0aac28f924161089b642133506e14763ae85a6",
      "size": 24616368
    },
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:943a99eb80b157123ac4ebda1849f4d2c68106887e02edab59cdc230df67cc32",
      "size": 66281931
    },
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:52808ac2056f6afb242a1edf3eac14b10bcf3524d0846f537555fb78803c9b22",
      "size": 218543478
    },
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:0d71beba07f61efdbce9791762654b9b1eaa24d1e21d5a2e7587ddabd5900391",
      "size": 2884197
    },
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:d0a75628b8e6ad0aea18ffa724f42d364f4c4e06af849a11e38375d51202deca",
      "size": 163326112
    },
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:2139d066866a5430853840a758efb53e146ad51e767a44a0496fea6a7cfa7907",
      "size": 9925
    },
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:0671e8115f2c7fd80eba5db4ce7f6b583c21063ce853f8e8ebf52aff306eb5a8",
      "size": 1949
    }
  ]
}

image config is sha256/339722f412f60e6c1f0397272dbf359041ca6facae6f8982852e5c9ceb18ec72
339722f412f60e6c1f0397272dbf359041ca6facae6f8982852e5c9ceb18ec72  blobs/sha256/339722f412f60e6c1f0397272dbf359041ca6facae6f8982852e5c9ceb18ec72
{
  "architecture": "amd64",
  "config": {
    "Env": [
      "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
      "GPG_KEYS=B215C1633BCA0477615F1B35A5B3A004745C015A \tB3C42148A44E6983B3E4CC0793FA9B1AB75C61B8 \t90AA470469D3965A87A5DCB494D03953902C9419 \t80F98B2E0DAB6C8281BDF541A7C8C3B2F71EDF1C \t7F74F97C103468EE5D750B583AB00996FC26A641 \t33C235A34C46AA3FFB293709A328C3A2C3C45C06 \tD3A93CAD751C2AF4F8C7AD516C35B99309B5FA62",
      "GCC_MIRRORS=https://ftpmirror.gnu.org/gcc \t\thttps://mirrors.kernel.org/gnu/gcc \t\thttps://bigsearcher.com/mirrors/gcc/releases \t\thttp://www.netgull.com/gcc/releases \t\thttps://ftpmirror.gnu.org/gcc \t\thttps://sourceware.org/pub/gcc/releases \t\tftp://ftp.gnu.org/gnu/gcc",
      "GCC_VERSION=14.1.0"
    ],
    "Cmd": [
      "bash"
    ]
  },
  "created": "2024-07-19T18:36:25Z",
  "os": "linux",
  "rootfs": {
    "type": "layers",
    "diff_ids": [
      "sha256:f6faf32734e0870d82ea890737958fe33ce9ddfed27b3b157576d2aadbab3322",
      "sha256:7cfafa82cfd2b6a92aeb90093e38fb88fa4377948d71bd970d11a51bae16d2f1",
      "sha256:0905150af928fc88e784dcad5ba98d5f3c2ab28c51c30ac7c7aa8599100cf02f",
      "sha256:ffe60aac26fce04aa507ee52ebf97f2da44fa5a2b475099d4260349c3e1cc329",
      "sha256:5fe68c2987b7407b200c91591f113c41bda431cd88bb64c98a53be5d17566499",
      "sha256:38015418a9aa829f58b79b76b4c0864652fa256633a471700e2d9a001fd462ae",
      "sha256:3c7faba6c607c147aeced81b13fb18b6367e7fee656c8845206dc87be631a66a",
      "sha256:b713d7309187d0334ad6025906b41026116c00c4c5eb1eb8fe55d903e2c7c639"
    ]
  }
}
The layer from the manifest is sha256/7ca350407cbfcb9d25b667d38417c1706bbf0feb3fd92fd8449e8c07bc0edc1c and decompresses to the config layer f6faf32734e0870d82ea890737958fe33ce9ddfed27b3b157576d2aadbab3322
This should equal sha256:f6faf32734e0870d82ea890737958fe33ce9ddfed27b3b157576d2aadbab3322
```

If we look at the start of this first layer, we see that most of these things are stored in the tar archive with uid/gid owner of 0/0. This makes sense because the rootfs we want to create for the container is just like the rootfs of a regular running system. On my host system we see that eg bin is a symlink to usr/bin and its owned by 0/0.

```bash
cd /tmp/gcc14-save
tar tvf blobs/sha256/7ca350407cbfcb9d25b667d38417c1706bbf0feb3fd92fd8449e8c07bc0edc1c | head -n10
echo
ls -ln / | head -n2
```

```
lrwxrwxrwx 0/0               0 2024-07-21 19:00 bin -> usr/bin
drwxr-xr-x 0/0               0 2024-03-29 12:20 boot/
drwxr-xr-x 0/0               0 2024-07-21 19:00 dev/
drwxr-xr-x 0/0               0 2024-07-21 19:00 etc/
-rw------- 0/0               0 2024-07-21 19:00 etc/.pwd.lock
-rw-r--r-- 0/0            3040 2023-05-25 10:54 etc/adduser.conf
drwxr-xr-x 0/0               0 2024-07-21 19:00 etc/alternatives/
-rw-r--r-- 0/0             100 2023-05-10 21:04 etc/alternatives/README
lrwxrwxrwx 0/0               0 2022-06-17 10:35 etc/alternatives/awk -> /usr/bin/mawk
lrwxrwxrwx 0/0               0 2022-06-17 10:35 etc/alternatives/awk.1.gz -> /usr/share/man/man1/mawk.1.gz

total 52
lrwxrwxrwx.   3 0 0    7 Jan 12  2024 bin -> usr/bin
```

However, when it comes time to run a container, these tar layers have to get unpacked (caveat, they don't _have_ to but for example podman defaults to when using overlay) (if they haven't already been unpacked) and that presents a problem because if we're running as a regular user 1000:

```bash
id
```

```
uid=1000(andrew) gid=1000(andrew) groups=1000(andrew),10(wheel) context=unconfined_u:unconfined_r:unconfined_t:s0-s0:c0.c1023
```

then we can't unpack a file and chown it to root

```bash
cd /tmp
touch foo
chown 0:0 foo
```

```

chown: changing ownership of 'foo': Operation not permitted

```

By default, when tar encounters a file with 0/0 in the archive and you're running as 1000, it just unpacks it as your user! This was surprising to me.

To make this a bit easier to see, we'll now export a flattened archive of all these layers combined (because omg the combining process of for example using `.wh.` prefix to delete files in layers below is kinda crazy; these have to then be unpacked as a character device 0/0 (device major/minor) [see docs](https://docs.kernel.org/filesystems/overlayfs.html#whiteouts-and-opaque-directories)).

```bash
cd /tmp/gcc14-save
image_manifest=$(jq -r '.manifests[0].digest' index.json | sed 's_:_/_')
last_layer=$(jq -r '.layers[-1].digest' blobs/$image_manifest | sed 's_:_/_')
tar tvf blobs/$last_layer | grep '\.wh\.'
```

```
---------- 0/0               0 1969-12-31 18:00 usr/bin/.wh.g++
---------- 0/0               0 1969-12-31 18:00 usr/bin/.wh.gcc
```

so we see the last layer includes two of these whiteout files. If we have a running instance and are using overlayfs, we can peek at it with something like

```
podman inspect aec3c2b7b25c | jq -r '.[0].GraphDriver.Data.LowerDir' | tr ':' '\n' | head -n1
```

```
/home/andrew/.local/share/containers/storage/overlay/52117ef866af096f2f7ee7486c81b86058ea13db74fa0641b462c8714a197808/diff
# ... lots more dirs
```

these lowerdirs are given in the order:

> The specified lower directories will be stacked beginning from the rightmost one and going left

So if we look at the first lowerdir (last layer)
```
ls -l /home/andrew/.local/share/containers/storage/overlay/52117ef866af096f2f7ee7486c81b86058ea13db74fa0641b462c8714a197808/diff
```

```
total 8
c---------. 1 1000 1000 0, 0 Jun  5 15:50 g++
c---------. 1 1000 1000 0, 0 Jun  5 15:50 gcc
lrwxrwxrwx. 1 1000 1000    6 Jan  8  2023 gcc.orig -> gcc-12
lrwxrwxrwx. 1 1000 1000    6 Jan  8  2023 g++.orig -> g++-12
```

we can see the (c)haracter device of major/minor 0/0. Idk what those symlinks are, maybe from an earlier layer.

Okay so on with exporting a flattened tar:

```bash
if [ ! -f /tmp/gcc14-export.tar ]; then
    # maybe there is a tool that does this better?
    id=$(podman create docker.io/library/gcc:14.1.0)
    podman export "$id" > /tmp/gcc14-export.tar
    podman rm "$id"
fi

if [ ! -d /tmp/gcc14-unpacked ]; then
    mkdir /tmp/gcc14-unpacked
    tar xf /tmp/gcc14-export.tar -C /tmp/gcc14-unpacked
fi

echo '-- from the tar --'
tar tvf /tmp/gcc14-export.tar bin boot dev etc/ | head -n4

echo
echo '-- from the unpacked --'
ls -ln /tmp/gcc14-unpacked | head -n5
```

```
-- from the tar --
lrwxrwxrwx 0/0               0 2024-05-12 19:00 bin -> usr/bin
drwxr-xr-x 0/0               0 2024-01-28 15:20 boot/
drwxr-xr-x 0/0               0 2024-05-12 19:00 dev/
drwxr-xr-x 0/0               0 2024-05-14 00:45 etc/

-- from the unpacked --
total 0
lrwxrwxrwx.  1 1000 1000    7 May 12 19:00 bin -> usr/bin
drwxr-xr-x.  2 1000 1000   40 Jan 28  2024 boot
drwxr-xr-x.  2 1000 1000   40 May 12 19:00 dev
drwxr-xr-x. 46 1000 1000 2020 May 14 00:45 etc
```

Now we see that the combined tar still has 0/0 owning things but when we unpack with tar (sans sudo), things get unpacked as 1000/1000.

In the tar, there are some things not 0/0:

```bash
tar tvf /tmp/gcc14-export.tar | grep -v '0/0'
```

```
-rw-r----- 0/42            373 2024-05-13 21:54 etc/gshadow
-rw-r----- 0/42            364 2024-05-12 19:00 etc/gshadow-
-rw-r----- 0/42            474 2024-05-12 19:00 etc/shadow
-rwxr-sr-x 0/42          80376 2023-03-23 07:40 usr/bin/chage
-rwxr-sr-x 0/42          31184 2023-03-23 07:40 usr/bin/expiry
-rwxr-sr-x 0/101        481664 2023-12-19 08:51 usr/bin/ssh-agent
drwxrwsr-x 0/50              0 2024-05-13 21:55 usr/local/share/fonts/
-rwxr-sr-x 0/42          39160 2023-09-21 15:55 usr/sbin/unix_chkpwd
drwx------ 42/0              0 2024-05-13 21:55 var/cache/apt/archives/partial/
drwxr-xr-x 42/0              0 2024-05-14 00:45 var/lib/apt/lists/auxfiles/
drwxrwsr-x 0/50              0 2024-01-28 15:20 var/local/
-rw-r----- 0/4           83466 2024-05-14 00:45 var/log/apt/term.log
-rw-rw---- 0/43              0 2024-05-12 19:00 var/log/btmp
-rw-rw-r-- 0/43              0 2024-05-12 19:00 var/log/lastlog
-rw-rw-r-- 0/43              0 2024-05-12 19:00 var/log/wtmp
drwxrwsr-x 0/8               0 2024-05-12 19:00 var/mail/
```

But when we unpacked, those too get 1000/1000:

```bash
ls -ln /tmp/gcc14-unpacked/etc/gshadow
```

```
-rw-r-----. 1 1000 1000 373 May 13 21:54 /tmp/gcc14-unpacked/etc/gshadow
```

But we can check inside the container things are 0/42 as they should be:

```bash
podman run --rm gcc:14.1.0 ls -ln /etc/gshadow
```

```
-rw-r-----. 1 0 42 373 Jul 23 06:06 /etc/gshadow
```

