---
layout: post
title:  "Mystery Sendmail Issue"
date:   2020-04-09
categories:
---

The other day I wrote a [toy example of using libaudit](https://github.com/aconz2/dnfpackageauditor) to trace all `execve(2)` calls on my system. This was fun, but in doing so noticed something very weird happening on my machine and took me a lot of head-scratching to figure out what was going on.

The output from my program looked like this
```
...
usr/bin/esmtp(12827)[-t] -- /usr/bin/bash(8024)[/usr/sbin/sendmail -t] -- /usr/lib/systemd/systemd(1)[--switched-root --system --deserialize 33]
expr(12828)[1553 + 1] -- /usr/bin/bash(8024)[/usr/sbin/sendmail -t] -- /usr/lib/systemd/systemd(1)[--switched-root --system --deserialize 33]
...
```

Each line of the output is a single `execve` call showing `{exe}({pid})[{args...}]` and we walk up the parent tree and show the same. (Aside: if you're writing a program that traces execve calls, don't exec anything while you're handling events from an exec!)

The above calls between `esmtp` and `expr` was repeated a bazillion times and seemed to happen on an interval. You can see that the same `bash` process 8024 is calling `esmtp` and then `expr` to increment a number: `1553 + 1`, the next was `1554 + 1` etc. (There was also a bunch of calls to `/usr/bin/dotlockfile` which I don't seem to have a record of.)

My initial thought was some systemd or cron scheduled task was trying to send mail, but I certainly didn't set that up and nothing turned up in any `grep -R sendmail /etc/` or similar search.

Looking at `/usr/sbin/sendmail`, it was actually a symlink to `/usr/bin/esmtp-wrapper`, which is a bash script (which is why process 8024 is `bash` and not `sendmail`). Doing a `dnf repoquery --installed --whatrequires esmtp` gives `redhat-lsb-core`. TBH I never figured out why that's installed since `dnf repoquery --installed --whatrequires redhat-lsb-core` gives nothing. Anyways, looking at  `esmtp-wrapper`, we can find our expr call in this function with the big arrow:

```bash
# ...
deliver_queue() { # ([background])
    local undelivered=0

    # when delivering in background, there is time to wait
    # for a potential burst run (git-send-email, e.g.) or
    # exiting of other delivery jobs.
    if [[ "$1" = "background" ]]; then
        sleep 5
    fi
    if ! $dotlockfile -p -l "$deliver_lock"; then   # ←⎼⎼⎼⎼⎼⎼⎼⎼⎼⎼⎼⎼⎼⎼ call to /usr/bin/dotlockfile
        return 1
    fi
    for dir in $qdir/*; do
        [ ! -d "$dir" ] && continue
        [ -f "$dir/lock" ] && continue
        send_mail "$dir"
        undelivered=`expr $undelivered + $?`        # ←⎼⎼⎼⎼⎼⎼⎼⎼⎼⎼⎼⎼⎼⎼ call to /usr/bin/expr
    done
    $dotlockfile -u "$deliver_lock"
    return $undelivered
}
# ...
```

It blows my mind that we all run software (this is certainly not the only place and I'm sure I do it too) that executes a new process to do addition!

After some more internet searching I finally found the culprit: `sudo`. `sudo` was configured to send an email to root every time a user used `sudo` (I guess this was the default on Fedora? Or maybe some bad config of policykit?). This mail was then going to my home directory `~/.esmtp_queue` where there were !thousands! of queued but undelivered emails! Each time `sudo` ran, it would try to send a new email, plus all the old ones that had failed.

I fixed it (hopefully for good) by doing the following:

```alternatives --remove-all mta```

This is a fine fix for me because I don't use any mta. I couldn't find a config option for "don't send any emails ever" in sudo.conf or sudoers or anything, so this at least stopped the insane cascade (and [accidentally quadratic](https://accidentallyquadratic.tumblr.com/)) of process calls. I know this is probably inconsequential on its known but on principal it is very annoying.
