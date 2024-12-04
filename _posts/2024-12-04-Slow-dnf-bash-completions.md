---
layout: post
title:  "Slow dnf bash completions"
date:   2024-12-04
categories:
---

I just tracked down something that has been plaguing me for as long as I can remember: slow dnf tab completion, both for commands (`in<TAB>`) and packages (`install lib<TAB>`). tldr is that my hostname was set to something that doesn't resolve. With hostname of `localhost` the problem goes away. It tries resolving the host because librepo calls `curl_version` which does LDAP stuff and wants to resolve the hostname. We just wanted completions...

The slightly longer version is:

In one terminal, `echo $$` (let's say 42) and then begin a command `dnf in` and don't hit enter.

In another terminal `strace -f -T -tt -p 42 |& tee /tmp/slowbash.out`

In there, we see a long `ppoll` call

```
[pid 706601] 14:09:31.149781 socket(AF_UNIX, SOCK_STREAM|SOCK_CLOEXEC|SOCK_NONBLOCK, 0) = 3 <0.000021>
[pid 706601] 14:09:31.149820 connect(3, {sa_family=AF_UNIX, sun_path="/run/systemd/resolve/io.systemd.Resolve"}, 42) = 0 <0.000056>
[pid 706601] 14:09:31.149916 sendto(3, "{\"method\":\"io.systemd.Resolve.Re"..., 89, MSG_DONTWAIT|MSG_NOSIGNAL, NULL, 0) = 89 <0.000010>
[pid 706601] 14:09:31.149965 brk(0x55f1235e3000) = 0x55f1235e3000 <0.000015>
[pid 706601] 14:09:31.150007 recvfrom(3, 0x55f1235a2570, 131080, MSG_DONTWAIT, NULL, NULL) = -1 EAGAIN (Resource temporarily unavailable) <0.000008>
[pid 706601] 14:09:31.150044 ppoll([{fd=3, events=POLLIN}], 1, {tv_sec=119, tv_nsec=999921000}, NULL, 8) = 1 ([{fd=3, revents=POLLIN}], left {tv_sec=116, tv_nsec=139550987}) <3.860404>
[pid 706601] 14:09:35.010518 recvfrom(3, "{\"error\":\"io.systemd.Resolve.DNS"..., 131080, MSG_DONTWAIT, NULL, NULL) = 65 <0.000015>
```

and we're sending a message to io.systemd.Resolve, so we get a hint that it is DNS.

One stray path I went down first was looking at the sqlite query that looks up packages in [`_dnf_query_db`](https://github.com/rpm-software-management/dnf/blob/69d1f641cda28fc543846524d15ec7291baf3e5a/etc/bash_completion.d/dnf-3#L111); that looks like this

```
time sqlite3 -batch -init /dev/null /var/cache/dnf/packages.db "select * from available where pkg like 'blue%' and pkg not in (select pkg from installed)"
```

but that is like 2ms, even though it uses a scan:

```
sqlite3 -batch -init /dev/null /var/cache/dnf/packages.db "explain query plan select * from available where pkg like 'blue%' and pkg not in (select pkg from installed)"
QUERY PLAN
|--SCAN available
`--USING INDEX pkg_installed FOR IN-OPERATOR
```

Could switch to `pkg glob 'blue*'` to use the index but this is not our issue.

```
|--SEARCH available USING COVERING INDEX pkg_available (pkg>? AND pkg<?)
`--USING INDEX pkg_installed FOR IN-OPERATOR
```

Back to DNS. I read through the bash completions further and found that it always calls [`_dnf_commands_helper`](https://github.com/rpm-software-management/dnf/blob/69d1f641cda28fc543846524d15ec7291baf3e5a/etc/bash_completion.d/dnf-3#L138) which does (essentially)

```
python -c "import sys; from dnf.cli import completion_helper as ch; ch.main(sys.argv[1:])"
```

So then if we inline the args, we can do

```
 python  -c 'import cProfile; from dnf.cli import completion_helper as ch; cProfile.run("ch.main([\"_cmds\", \"\"])", sort="time")'
```

and see the top hit is

```
         39099 function calls (38273 primitive calls) in 3.840 seconds

   Ordered by: internal time

   ncalls  tottime  percall  cumtime  percall filename:lineno(function)
        1    3.807    3.807    3.807    3.807 {built-in method libdnf._conf.new_ConfigMain}
```

Then I simplified further and brought it into gdb

```
gdb --args python -c 'import libdnf; libdnf.conf.ConfigMain()'
# run then ctrl-c after a second, then where
```

```
#1  0x00007fffe77760af in ppoll (__fds=0x7fffffffbba0, __nfds=1, __timeout=<optimized out>, __ss=0x0)
    at /usr/include/bits/poll2.h:88
#2  ppoll_usec.constprop.0 (fds=fds@entry=0x7fffffffbba0, timeout=<optimized out>, nfds=1)
    at ../src/basic/io-util.c:214
#3  0x00007fffe776f3a3 in fd_wait_for_event (fd=<optimized out>, event=<optimized out>, timeout=<optimized out>)
    at ../src/basic/io-util.c:241
#4  varlink_wait (timeout=18446744073709551615, v=0x55555555b1a0) at ../src/shared/varlink.c:1498
#5  varlink_call.constprop.0 (v=0x55555555b1a0,
    method=method@entry=0x7fffe777a148 "io.systemd.Resolve.ResolveHostname", parameters=<optimized out>,
    ret_parameters=ret_parameters@entry=0x7fffffffbc98, ret_error_id=ret_error_id@entry=0x7fffffffbc90,
    ret_flags=0x0) at ../src/shared/varlink.c:2007
#6  0x00007fffe7766b68 in _nss_resolve_gethostbyname4_r (name=name@entry=0x7fffffffc960 "toolbx",
    pat=pat@entry=0x7fffffffbeb0, buffer=0x7fffffffbfc0 "", buflen=1024, errnop=0x7ffff7ed46b8,
    h_errnop=h_errnop@entry=0x7ffff7ed4708, ttlp=0x0) at ../src/nss-resolve/nss-resolve.c:264
#7  0x00007ffff77585d1 in get_nss_addresses (name=<optimized out>, req=<optimized out>, tmpbuf=0x7fffffffbfb0,
    res=0x7fffffffbeb0) at getaddrinfo.c:652
#8  gaih_inet (name=<optimized out>, service=<optimized out>, req=<optimized out>, pai=0x7fffffffbe80,
    naddrs=<synthetic pointer>, tmpbuf=0x7fffffffbfb0) at getaddrinfo.c:1185
#9  __GI_getaddrinfo (name=<optimized out>, name@entry=0x7fffffffc960 "toolbx", service=<optimized out>,
    service@entry=0x0, hints=<optimized out>, hints@entry=0x7fffffffc930, pai=pai@entry=0x7fffffffc928)
    at getaddrinfo.c:2391
#10 0x00007fffe7e39ef7 in ldap_pvt_get_fqdn (name=0x7fffffffc960 "toolbx", name@entry=0x0)
    at /usr/src/debug/openldap-2.6.7-1.fc40.x86_64/openldap-2.6.7/libraries/libldap/util-int.c:812
#11 0x00007fffe7e3afa0 in ldap_int_initialize (gopts=0x7fffe7e60000 <ldap_int_global_options>, dbglvl=0x0)
    at /usr/src/debug/openldap-2.6.7-1.fc40.x86_64/openldap-2.6.7/libraries/libldap/init.c:693
#12 0x00007fffe7e3b5a2 in ldap_get_option (ld=ld@entry=0x0, option=option@entry=0,
    outvalue=outvalue@entry=0x7fffffffcaf0)
    at /usr/src/debug/openldap-2.6.7-1.fc40.x86_64/openldap-2.6.7/libraries/libldap/options.c:107
#13 0x00007fffe8ae005e in curl_version () at ../../lib/version.c:264
#14 0x00007ffff7e19356 in lr_log_librepo_summary () at /usr/src/debug/librepo-1.18.1-1.fc40.x86_64/librepo/util.c:78
#15 0x00007ffff7e19472 in lr_init_once_cb (user_data=<optimized out>)
    at /usr/src/debug/librepo-1.18.1-1.fc40.x86_64/librepo/util.c:95
#16 0x00007fffe91a4d6d in g_once_impl (once=0x7ffff7e2f360 <init_once>, func=0x7ffff7e19430 <lr_init_once_cb>,
    arg=0x0) at ../glib/gthread.c:562
#17 0x00007fffe92f7e9b in dnf_context_globals_init (error=0x7fffffffcea0)
    at /usr/src/debug/libdnf-0.73.3-1.fc40.x86_64/libdnf/dnf-context.cpp:408
#18 0x00007fffe9370e2b in libdnf::initLibRpm ()
    at /usr/src/debug/libdnf-0.73.3-1.fc40.x86_64/libdnf/utils/os-release.cpp:85
#19 0x00007fffe9371359 in libdnf::getCanonOs ()
    at /usr/src/debug/libdnf-0.73.3-1.fc40.x86_64/libdnf/utils/os-release.cpp:101
#20 libdnf::getUserAgent (osReleaseData=std::map with 22 elements = {...})
    at /usr/src/debug/libdnf-0.73.3-1.fc40.x86_64/libdnf/utils/os-release.cpp:127
#21 0x00007fffe9371975 in libdnf::getUserAgent[abi:cxx11]() ()
    at /usr/src/debug/libdnf-0.73.3-1.fc40.x86_64/libdnf/utils/os-release.cpp:153
#22 0x00007fffe9377462 in libdnf::ConfigMain::Impl::Impl (this=<optimized out>, owner=..., this=<optimized out>,
    owner=...) at /usr/src/debug/libdnf-0.73.3-1.fc40.x86_64/libdnf/conf/ConfigMain.cpp:371
#23 0x00007fffe937a267 in libdnf::ConfigMain::ConfigMain (this=<optimized out>, this=<optimized out>)
    at /usr/src/debug/libdnf-0.73.3-1.fc40.x86_64/libdnf/conf/ConfigMain.cpp:542
#24 0x00007fffe97a87f1 in _wrap_new_ConfigMain (self=<optimized out>, args=<optimized out>)
    at /usr/src/debug/libdnf-0.73.3-1.fc40.x86_64/build-py3/bindings/python/CMakeFiles/_conf.dir/confPYTHON_wrap.cxx:21661
```

And we see our friend `curl_version`, which is only called in a info logging function [`lr_log_librepo_summary`](https://github.com/rpm-software-management/librepo/blob/7955987e33ba98dddb3fc2c63bb6dc892e3505fa/librepo/util.c#L82) to get a string like

```
libcurl/8.6.0 OpenSSL/3.2.2 zlib/1.3.1.zlib-ng brotli/1.1.0 libidn2/2.3.7 libpsl/0.21.5 libssh/0.10.6/openssl/zlib nghttp2/1.59.0 OpenLDAP/2.6.7
```

LDAP tries to resolve the hostname, which in a toolbox container is `toolbx` (not a typo!) and so (at least for me), `resolvectl query toolbx` takes 3.5 seconds and doesn't resolve. I've had this issue previously because I had always set my hostname to something other than localhost that never resolved either, so I suspect it is the same issue. Though I just checked my laptop which has hostname `andrew-laptop` and does resolve I think because of DHCP, maybe because it is on wifi? Tab complete is still not rapid so maybe I'll look at that later.

One solution is to setup the hostname to resolve correctly, but on the other hand, why do we have to resolve our hostname just to get command completions...
