---
layout: post
title:  "Building Python Wheels For Raspberry Pi Zero"
date:   2026-08-07
categories:
---

It can be a pain if you need to install python packages on a Pi Zero and there are no wheels available because of the low memory and slow CPU. This is relevant for things that use Cython etc.

There are a few things I came across in searching about this problem and here is what works well for me:

# Setup

We'll use qemu's binfmt capability to translate binaries on the fly to let us run on amd64 with all our host memory.

```bash
# I'm not positive qemu-user-static is necessary, I'm writing this up a few weeks afterwards
sudo dnf install qemu-user-binfmt qemu-user-static
systemctl restart systemd-binfmt.service
```

# Build

Grab the pi zero `.img` and build it into a container image with the right CPU set, then build another container on top that has `pip`.

```bash
set -e

img=2026-06-18-raspios-bookworm-armhf-lite.img
url="https://downloads.raspberrypi.com/raspios_oldstable_lite_armhf/images/raspios_oldstable_lite_armhf-2026-06-19/2026-06-18-raspios-bookworm-armhf-lite.img.xz"

if [ ! -f "$img" ]; then
    curl "$url" | xzcat - > "$img"
fi

loopdev=$(sudo losetup --partscan --find --show "$img")

mkdir -p mount

sudo mount "$loopdev"p2 mount

sudo tar -C mount -c {usr,lib,bin,var,etc,tmp} | podman import --arch=armv6l \
    --change ENV=QEMU_CPU=arm1176 \
    --change 'CMD=["/bin/bash"]' \
    - pizero-base

podman build --arch=armv6l -t pizero-py -f - << 'EOF'
FROM localhost/pizero-base:latest
RUN apt-get update && apt-get install -y python3-pip
EOF

sudo umount mount

sudo losetup -d "$loopdev"
```

# Usage

We can now run something like
```
→ podman run --rm pizero-base bash -c 'lscpu | head'
WARNING: image platform (linux/armv6l) does not match the expected platform (linux/amd64)
Architecture:                            armv6l
CPU op-mode(s):                          32-bit, 64-bit
Address sizes:                           48 bits physical, 48 bits virtual
Byte Order:                              Little Endian
CPU(s):                                  32
On-line CPU(s) list:                     0-31
Vendor ID:                               AuthenticAMD
Model name:                              AMD Ryzen 9 5950X 16-Core Processor
CPU family:                              25
Model:                                   33
```

and see that the computer thinks we are on `armv6l` on a 5950x...

To do something useful, we can build a wheel for `zeroconf` like this:
```
→ mkdir -p wheels
→ podman run --rm -v $(readlink -f wheels):/wheels:z pizero-py pip wheel -w wheels zeroconf
→ ls wheels
zeroconf-0.150.0-cp311-cp311-linux_armv6l.whl
```

I then rsync them to the actual pi and then pip (or `venv/bin/pip`) install them

```bash
rsync -av wheels/ pizero:wheels/
# on pizero
pip install wheels/*.whl
```

