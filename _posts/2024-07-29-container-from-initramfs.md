---
layout: post
title:  "Container from initramfs"
date:   2024-07-29
categories:
---

Here is a way to run a container from initramfs, which on my machine runs `gcc --version` from the 14.1.0 image in a virtual machine in ~170ms.

I'm no expert here so mistakes beware.

The overall setup is to use `cloud-hypervisor` to run a `crun` from an initramfs. We pass a squashfs image of the container's rootfs as a virtual disk `/dev/vda` and for this article I've just preloaded the `config.json` with the `process.args` changed to `["gcc", "--version"]` (not shown here, just use `crun spec` to generate a default one and change it).

I quickly hit a roadblock where `crun` was giving the error `pivot_root: invalid argument` (aka `EINVAL`). I did use `--no-pivot` successfully but that is less secure (or perhaps totally unsafe?) since it only uses `chroot` (see [this issue](https://github.com/containers/crun/issues/56) for some info).

The `EINVAL` error we get is unhelpfully listed in the man pages as any of:

```
EINVAL new_root is not a mount point.
EINVAL put_old is not at or underneath new_root.
EINVAL The current root directory is not a mount point (because of an earlier chroot(2)).
EINVAL The current root is on the rootfs (initial ramfs) mount; see NOTES.
EINVAL Either the mount point at new_root, or the parent mount of that mount point, has propagation type MS_SHARED.
EINVAL put_old is a mount point and has the propagation type MS_SHARED.
```

I debugged the kernel (first for me!) to see this better and tracked it to this line in `fs/namespace.c` `if (new_mnt->mnt.mnt_flags & MNT_LOCKED)`. Though for what's about to come, the line `if (!mnt_has_parent(new_mnt))` would make more sense, not sure.

I then serendipitously (posted the day after I hit my error) found [this containers/bubblewrap comment](https://github.com/containers/bubblewrap/issues/592#issuecomment-2243087731) which showed a workaround (in pseudocode):

```
unshare --mount
mount --rbind / /abc --mkdir
cd /abc
mount --move . /
chroot .
```

which to my eyes looked like total magic. Let's try to understand it a bit better by running our thing and printing out `/proc/self/mountinfo` ([docs](https://www.kernel.org/doc/html/latest/filesystems/proc.html?highlight=mountinfo#proc-pid-mountinfo-information-about-mounts)).

One of my first points of confusion was how many places it is documented that you "can't" `pivot_root` on initramfs:

* The [pivot_root man pages](https://man7.org/linux/man-pages/man2/pivot_root.2.html) say "The  rootfs (initial ramfs) cannot be pivot_root()ed."
* The [kernel docs](https://docs.kernel.org/filesystems/ramfs-rootfs-initramfs.html?highlight=initramfs#what-is-initramfs) say " But initramfs is rootfs: you can neither pivot_root rootfs, nor unmount it"
* The [kernel source](https://github.com/torvalds/linux/blob/ffc253263a1375a65fa6c9f62a893e9767fbebfa/fs/namespace.c#L4154) says "* Also, the current root cannot be on the 'rootfs' (initial ramfs) filesystem."

As you'll see below, I've split up the workaround into 2 extra files - `init2` and `init3` - because `unshare(1)` (remember `(1)` is the name overload resolver meaning we're talking about the exe named `unshare` and not the system call named `unshare` which is `unshare(2)`) and `chroot(1)` have to execute a new program to take effect. This is because the `sh` has to create a new process to run `unshare(1)` and the child process calls `unshare(2)` but that would have no effect on the parent process. So instead, `unshare(1)` calls `unshare(2)` then exec's the process you tell it to, `init2` in this case. Another way would be to patch `crun` to run these things and is something I plan on trying under a `--extra-pivot-root` flag or the like (could also auto-detect `/` is rootfs and has no parent (which is what the kata agent does), but I don't like that as much).

## setup

Download `cloud-hypervisor`, `busybox`, and `crun`. Yay static exes

```
wget https://github.com/cloud-hypervisor/cloud-hypervisor/releases/download/v40.0/cloud-hypervisor-static
chmod +x cloud-hypervisor-static
wget https://www.busybox.net/downloads/binaries/1.35.0-x86_64-linux-musl/busybox
wget https://github.com/containers/crun/releases/download/1.15/crun-1.15-linux-amd64
```

Download and build a kernel, I am using 6.6.0 here with `CONFIG_SQUASHFS=y` and `CONFIG_VIRTIO*=y` (I think I started with a config from [kata](https://github.com/kata-containers/kata-containers/tree/main/tools/packaging/kernel/configs) but don't have a note of that. Those are for some older versions so I remember doing some updates when doing `make menuconfig`. I'm assuming your kernel is built at `~/Repos/linux/vmlinux`.

### initramfs.file

This is like a simplified Containerfile/Dockerfile but for a cpio file instead.

```
dir /bin 0755 0 0
dir /dev 0755 0 0
dir /proc 0755 0 0
dir /abc 0755 0 0

dir /sys 0755 0 0
dir /sys/fs 0755 0 0
dir /sys/fs/cgroup 0755 0 0

dir /run 0755 0 0
dir /run/bundle 0755 0 0
dir /run/bundle/rootfs 0755 0 0

nod /dev/console 0600 0 0 c 5 1

file /init      init1 0555 0 0
file /bin/init2 init2 0555 0 0
file /bin/init3 init3 0555 0 0

file /bin/busybox busybox 0555 0 0
file /bin/crun crun-1.15-linux-amd64 0555 0 0

file /run/bundle/config.json config.json 0444 0 0
```

### makeinitramfs.sh

This runs the `gen_init_cpio` tool from the linux tree and generates a cpio archive. Use `cpio -t < initramfs` to inspect.

```
~/Repos/linux/usr/gen_init_cpio initramfs.file > initramfs
```

### init1

This is the `/init` program run by the kernel after it unpacks the initramfs.

* mounts the necessary filesystems for things to run
* runs `init2` in a new mount namespace.
* shuts down the vm when it exits

```
#!/bin/busybox sh

export PATH=/bin

# otherwise we get a kernel panic and the vmm process hangs
trap "busybox poweroff -f" EXIT

# crun needs /proc/self/exe for stuff, cgroup_root for containers, and devtmpfs for mounting our sqfs
busybox mount -t proc none /proc
busybox mount -t cgroup2 none /sys/fs/cgroup
busybox mount -t devtmpfs none /dev
busybox mount -t squashfs -o loop /dev/vda /run/bundle/rootfs

echo '---------------------mountinfo init1 before -----------------------------'
busybox awk -e '{printf("%2d %2d %6s %3s %-25s %-10s\n", $1, $2, $3, $4, $5, $8);}' /proc/self/mountinfo
echo '-------------------------------------------------------------------------'

busybox unshare --mount /bin/init2

echo '---------------------mountinfo init1 after ---------------------------'
busybox awk -e '{printf("%2d %2d %6s %3s %-25s %-10s\n", $1, $2, $3, $4, $5, $8);}' /proc/self/mountinfo
echo '----------------------------------------------------------------------'
```

### init2

init2 does the real work.

* `--rbind` makes everyting we've mounted starting at `/` also available under `/abc`.
* `--move` then moves this bind mount to `/` which shadows our original root `rootfs`
* execs `init3` in a `chroot` which cleans up our mount point list and I think makes the original `/` mount inaccessible (or at least non-adversarially?)

```
#!/bin/busybox sh

busybox mount --rbind / /abc

echo '---------------------mount --rbind / /abc -------------------------------'
busybox awk -e '{printf("%2d %2d %6s %3s %-25s %-10s\n", $1, $2, $3, $4, $5, $8);}' /proc/self/mountinfo
echo '-------------------------------------------------------------------------'

cd /abc
busybox mount --move . /

echo '----------------cd /abc && mount --move . / -----------------------------'
busybox awk -e '{printf("%2d %2d %6s %3s %-25s %-10s\n", $1, $2, $3, $4, $5, $8);}' /proc/self/mountinfo
echo '-------------------------------------------------------------------------'

exec busybox chroot . /bin/init3
```

### init3

init3 just runs our container. The `config.json` is already statically populated and we've mounted the container's `rootfs` from the squashfs to `/run/bundle/rootfs` already.

```
#!/bin/busybox sh

echo '---------------------chroot . (/abc) ------------------------------------'
busybox awk -e '{printf("%2d %2d %6s %3s %-25s %-10s\n", $1, $2, $3, $4, $5, $8);}' /proc/self/mountinfo
echo '-------------------------------------------------------------------------'

crun run --bundle /run/bundle containerid-1234
```

### cloudhypervisormyinit.sh

```
./cloud-hypervisor-static \
    --kernel ~/Repos/linux/vmlinux \
    --initramfs initramfs \
    --cmdline "console=hvc0" \
    --disk path=gcc-squashfs.sqfs,readonly=on \
    --cpus boot=1 \
    --memory size=1024M
```

### qemumyinitdebug.sh

We can also run under qemu. I'm not sure how much of this is correct b/c qemu confuses me. But it does let us debug the kernel in conjunction with the next script.

I'm using the microvm here because it behaves better with the qemu process exiting after the vm shuts down. With the default machine type, I got `-device pvpanic-pci` to work, but then something else wasn't working. I was also testing it for the speed of boot compared to cloud hypervisor. The `-S` pauses execution so that we can insert our breakpoints.

```
qemu-system-x86_64 \
    -M microvm,pit=off,pic=off,isa-serial=off,rtc=off \
    -nographic -no-user-config -nodefaults \
    -gdb tcp::1234 \
    -enable-kvm \
    -cpu host -smp 1 -m 1G \
    -kernel ~/Repos/linux/vmlinux -append "console=hvc0" \
    -device virtio-blk-device,drive=test \
    -drive id=test,file=gcc-squashfs.sqfs,read-only=on,format=raw,if=none \
    -initrd init1.initramfs \
    -chardev stdio,id=virtiocon0 \
    -device virtio-serial-device \
    -device virtconsole,chardev=virtiocon0 \
    -S
```

### debug.sh

note that I had to use hardware breakpoints, was getting errors otherwise (maybe could use regular breakpoints if we don't use `-cpu host`?).

```
lldb -o 'gdb-remote localhost:1234' -o 'break set -H -f namespace.c -l 4197' ~/Repos/linux/vmlinux
# can also use gdb but was getting "blah is optimized out" unhelpfulness
# gdb -ex 'target remote localhost:1234' ~/Repos/linux/vmlinux -ex 'hbreak namespace.c:4197'
```

## Run

```
bash makeinitramfs.sh && bash cloudhypervisormyinit.sh
```

kernel messages omitted (and some extra newlines inserted)

The `/proc/self/mountinfo` subset quoted from [docs](https://www.kernel.org/doc/html/latest/filesystems/proc.html?highlight=mountinfo#proc-pid-mountinfo-information-about-mounts) displayed is: 

1) mount ID:  unique identifier of the mount (may be reused after umount)
2) parent ID:  ID of parent (or of self for the top of the mount tree)
3) major:minor:  value of st_dev for files on filesystem
4) root:  root of the mount within the filesystem
5) mount point:  mount point relative to the process's root
9) filesystem type:  name of filesystem of the form "type[.subtype]"

I've labeled each snapshot of mountinfo on the right

```
---------------------mountinfo init1 before ----------------------------- (1)
 1  1    0:2   / /                         rootfs    
19  1   0:18   / /proc                     proc      
20  1   0:19   / /sys/fs/cgroup            cgroup2   
21  1    0:5   / /dev                      devtmpfs  
22  1  254:0   / /run/bundle/rootfs        squashfs  
-------------------------------------------------------------------------

---------------------mount --rbind / /abc ------------------------------- (2)
23 23    0:2   / /                         rootfs    
24 23   0:18   / /proc                     proc      
25 23   0:19   / /sys/fs/cgroup            cgroup2   
26 23    0:5   / /dev                      devtmpfs  
27 23  254:0   / /run/bundle/rootfs        squashfs  
28 23    0:2   / /abc                      rootfs    
29 28   0:18   / /abc/proc                 proc      
30 28   0:19   / /abc/sys/fs/cgroup        cgroup2   
31 28    0:5   / /abc/dev                  devtmpfs  
32 28  254:0   / /abc/run/bundle/rootfs    squashfs  
-------------------------------------------------------------------------

----------------cd /abc && mount --move . / ----------------------------- (3)
23 23    0:2   / /                         rootfs    
24 23   0:18   / /proc                     proc      
25 23   0:19   / /sys/fs/cgroup            cgroup2   
26 23    0:5   / /dev                      devtmpfs  
27 23  254:0   / /run/bundle/rootfs        squashfs  
28 23    0:2   / /                         rootfs    
29 28   0:18   / /proc                     proc      
30 28   0:19   / /sys/fs/cgroup            cgroup2   
31 28    0:5   / /dev                      devtmpfs  
32 28  254:0   / /run/bundle/rootfs        squashfs  
-------------------------------------------------------------------------

---------------------chroot . (/abc) ------------------------------------ (4)
28 23    0:2   / /                         rootfs    
29 28   0:18   / /proc                     proc      
30 28   0:19   / /sys/fs/cgroup            cgroup2   
31 28    0:5   / /dev                      devtmpfs  
32 28  254:0   / /run/bundle/rootfs        squashfs  
-------------------------------------------------------------------------

[    0.058861] crun[669]: memfd_create() called without MFD_EXEC or MFD_NOEXEC_SEAL set
gcc (GCC) 14.1.0
Copyright (C) 2024 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

---------------------mountinfo init1 after --------------------------- (5)
 1  1    0:2   / /                         rootfs    
19  1   0:18   / /proc                     proc      
20  1   0:19   / /sys/fs/cgroup            cgroup2   
21  1    0:5   / /dev                      devtmpfs  
22  1  254:0   / /run/bundle/rootfs        squashfs  
----------------------------------------------------------------------
```

## Discussion

* Our `rootfs` has id 1 in `(1)` and parent id 1, which means it has no parent mount (`mnt_has_parent(struct mount)` checks `mnt != mnt->parent` in `fs/mount.h`)
  * And in the new mount namespace, it has id 23 and parent 23 so same thing
* We can see that because we run `init2` in a new mount namespace, `(1)` and `(5)` are identical
  * Also that the `/` rootfs has id 1 in `(1)` and 23 in `(2)`
* The `--rbind` in `(2)` binds all the mounts `rootfs proc cgroup2 devtmpfs squashfs` under `/abc`, not just `rootfs`
  * The resulting bind mount `rootfs` is id 28 with parent 23 (the real `rootfs`). We now have a parent mount for our rootfs!
* The `--move` in `(3)` then moves our bind mounts from `/abc` to `/`
* The `chroot` in `(4)` then hides our original set of mounts so we only see mounts starting with id 28
* Then some warning from the kernel about `memfd_create` that I haven't looked into
* Then the output of `gcc --version` running in its container

I was reading what kata containers do in this situation to see if they did something similar (only after I knew about the workaround), but it looks like as of writing this they [essentially use --no-pivot](https://github.com/kata-containers/kata-containers/blob/d7637f93f9ac0aa5a57496f25ffd68b5d302a7a6/src/agent/src/sandbox.rs#L148) when the kata agent is init. They are passing the `no_pivot_root` option to `runc` I believe but the effect is the same as `--no-pivot` in `crun`.

## Extra

### stracing crun

I wanted to see the state of `/proc/self/mountinfo` when `crun` is doing its `pivot_root` in [`do_pivot`](https://github.com/containers/crun/blob/cd722fa81d03a5420d622ec3c97db752de92238c/src/libcrun/linux.c#L1873). I wish `strace` had an option for running a hook command on trace events, but it doesn't, so I hacked one in:

```
--- a/src/syscall.c
+++ b/src/syscall.c
@@ -1021,6 +1021,9 @@ syscall_exiting_trace(struct tcb *tcp, struct timespec *ts, int res)
        dumpio(tcp);
        line_ended();
 
+    system("busybox awk -e '{printf(\"%2d %2d %6s %3s %-25s %-10s\\n\", $1, $2, $3, $4, $5, $8);}' /proc/self/mountinfo 1>&2 && busybox sha256sum /proc/self/mountinfo 1>&2");
+    tprints_string("-------------------------------------------------------------------\n");
+
 #ifdef ENABLE_STACKTRACE
        if (stack_trace_mode)
                unwind_tcb_print(tcp);
```

build with `./configure LDFLAGS='-static'`

symlink busybox to `/bin/sh` so that `system(3)` works

```
# pseudo diff for inintramfs.file
+ slink /bin/sh /bin/busybox 0555 0 0
+ file /bin/strace /home/andrew/Repos/strace/src/strace 0555 0 0
```

```
# pseudo diff for init3
- crun run --bundle /run/bundle containerid-1234
+ strace -f --trace pivot_root,mount,umount2 crun run --bundle /run/bundle containerid-1234
```

Ultimately this isn't even interesting, because the mountinfo looks the same the whole time on all 52 calls (hence why I included the shasum so I could quickly scan). In the output below, I'm just showing the regular strace output because the mountinfo is always the same as `(4)` above. I still don't actually know what `pivot_root . .` achieves.

<details markdown="1">
<summary>The strace output</summary>

```
strace: Process 673 attached
[pid   673] mount(NULL, "/", NULL, MS_REC|MS_PRIVATE, NULL) = 0
[pid   673] mount(NULL, "/run/bundle/rootfs", NULL, MS_PRIVATE, NULL) = 0
[pid   673] mount("/run/bundle/rootfs", "/run/bundle/rootfs", NULL, MS_BIND|MS_REC, NULL) = 0
[pid   673] mount(NULL, "/run/bundle/rootfs", NULL, MS_REC|MS_PRIVATE, NULL) = 0
[pid   673] mount(NULL, "/run/bundle/rootfs", NULL, MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount("proc", "/proc/self/fd/6", "proc", 0, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/8", NULL, MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount("tmpfs", "/proc/self/fd/6", "tmpfs", MS_NOSUID|MS_STRICTATIME, "mode=755,size=65536k") = 0
[pid   673] mount(NULL, "/proc/self/fd/8", NULL, MS_NOSUID|MS_REMOUNT|MS_BIND|MS_STRICTATIME, NULL) = 0
[pid   673] mount("devpts", "/proc/self/fd/8", "devpts", MS_NOSUID|MS_NOEXEC, "newinstance,ptmxmode=0666,mode=0"...) = 0
[pid   673] mount(NULL, "/proc/self/fd/6", NULL, MS_NOSUID|MS_NOEXEC|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount("shm", "/proc/self/fd/8", "tmpfs", MS_NOSUID|MS_NODEV|MS_NOEXEC, "mode=1777,size=65536k") = 0
[pid   673] mount(NULL, "/proc/self/fd/6", NULL, MS_NOSUID|MS_NODEV|MS_NOEXEC|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount("mqueue", "/proc/self/fd/8", "mqueue", MS_NOSUID|MS_NODEV|MS_NOEXEC, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/6", NULL, MS_NOSUID|MS_NODEV|MS_NOEXEC|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount("sysfs", "/proc/self/fd/6", "sysfs", MS_NOSUID|MS_NODEV|MS_NOEXEC, NULL) = 0
[pid   673] mount("cgroup2", "/proc/self/fd/6", "cgroup2", MS_NOSUID|MS_NODEV|MS_NOEXEC|MS_RELATIME, NULL) = 0
[pid   673] mount("tmpfs", "/proc/self/fd/6", "tmpfs", 0, "size=0k") = 0
[pid   673] mount("/dev/null", "/proc/self/fd/6", NULL, MS_BIND, NULL) = 0
[pid   673] mount("/dev/null", "/proc/self/fd/6", NULL, MS_BIND, NULL) = 0
[pid   673] mount("/dev/null", "/proc/self/fd/6", NULL, MS_BIND, NULL) = 0
[pid   673] mount("tmpfs", "/proc/self/fd/6", "tmpfs", 0, "size=0k") = 0
[pid   673] mount("/proc/self/fd/6", "/proc/self/fd/6", NULL, MS_BIND|MS_REC, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/15", NULL, MS_REC|MS_PRIVATE, NULL) = 0
[pid   673] mount("/proc/self/fd/6", "/proc/self/fd/6", NULL, MS_BIND|MS_REC, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/16", NULL, MS_REC|MS_PRIVATE, NULL) = 0
[pid   673] mount("/proc/self/fd/6", "/proc/self/fd/6", NULL, MS_BIND|MS_REC, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/17", NULL, MS_REC|MS_PRIVATE, NULL) = 0
[pid   673] mount("/proc/self/fd/6", "/proc/self/fd/6", NULL, MS_BIND|MS_REC, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/18", NULL, MS_REC|MS_PRIVATE, NULL) = 0
[pid   673] mount("/proc/self/fd/6", "/proc/self/fd/6", NULL, MS_BIND|MS_REC, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/19", NULL, MS_REC|MS_PRIVATE, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/19", NULL, MS_RDONLY|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/18", NULL, MS_RDONLY|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/17", NULL, MS_RDONLY|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/16", NULL, MS_RDONLY|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/15", NULL, MS_RDONLY|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/14", NULL, MS_RDONLY|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/13", NULL, MS_RDONLY|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/12", NULL, MS_RDONLY|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/11", NULL, MS_RDONLY|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/10", NULL, MS_RDONLY|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/9", NULL, MS_RDONLY|MS_NOSUID|MS_NODEV|MS_NOEXEC|MS_REMOUNT|MS_BIND|MS_RELATIME, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/8", NULL, MS_RDONLY|MS_NOSUID|MS_NODEV|MS_NOEXEC|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/proc/self/fd/5", NULL, MS_RDONLY|MS_REMOUNT|MS_BIND, NULL) = 0
[pid   673] pivot_root(".", ".")        = 0
[pid   673] mount(NULL, ".", NULL, MS_REC|MS_PRIVATE, NULL) = 0
[pid   673] umount2(".", MNT_DETACH)    = 0
[pid   673] umount2(".", MNT_DETACH)    = -1 EINVAL (Invalid argument)
[pid   673] mount(NULL, "/", NULL, MS_REC|MS_PRIVATE, NULL) = 0
[pid   673] mount("/dev/pts/0", "/dev/console", NULL, MS_BIND, NULL) = 0
[pid   673] mount(NULL, "/dev/console", NULL, MS_REMOUNT|MS_BIND, NULL) = 0
```

</details>

### inside the container

This is from running `sh -c 'cat /proc/self/mountinfo'` inside our container (by changing the config.json args). Note the ids are different because the container is in another mount namespace.

```
44 33  254:0 /               /                         squashfs  
45 44   0:21 /               /proc                     proc      
46 44   0:22 /               /dev                      tmpfs     
47 46   0:23 /               /dev/pts                  devpts    
48 46   0:24 /               /dev/shm                  tmpfs     
49 46   0:20 /               /dev/mqueue               mqueue    
50 44   0:25 /               /sys                      sysfs     
51 50   0:19 /               /sys/fs/cgroup            cgroup2   
52 45   0:26 /               /proc/acpi                tmpfs     
53 45    0:5 /null           /proc/kcore               devtmpfs  
54 45    0:5 /null           /proc/keys                devtmpfs  
55 45    0:5 /null           /proc/timer_list          devtmpfs  
56 50   0:27 /               /sys/firmware             tmpfs     
57 45   0:21 /bus            /proc/bus                 proc      
58 45   0:21 /fs             /proc/fs                  proc      
59 45   0:21 /irq            /proc/irq                 proc      
60 45   0:21 /sys            /proc/sys                 proc      
61 45   0:21 /sysrq-trigger  /proc/sysrq-trigger       proc      
38 46   0:23 /0              /dev/console              devpts    
```
