---
layout: post
title:  "PSA Zoom Ringcentral Interop"
date:   2018-01-29
categories:
---

I have recently undergone the misfortune of being forced to switch from Zoom meetings to RingCentral meetings. Zoom is one of the few pieces of software I have used that is super solid - the call quality is good, the screen sharing quality is good, it supports big groups, and has a Linux client. It is right up there with magit on my favorites list.

RingCentral resells a whitelabel version of Zoom under their own brand, **but offers no Linux client**. I face-palmed so hard when I saw this. I was sour for a while trying to get a Windows VM working with audio and yadda yadda...

The punchline is that, at least as far as I've tried, the Linux Zoom client will connect to RingCentral meetings! Just enter the meeting id (which appears at the end of the URL). When I get a free second, I will probably write a Tampermonkey script that auto-redirects urls from ringcentral to zoom (so that the Zoom client will auto-open).

The one potential caveat is that the company I Zoom-meeting with still has an active (but soon to-be-cancelled) Zoom subscription, so I will update this if this "hack" happens to stop working after that ends. In that event, I will have no choice but to begin reverse engineering the network traffic to try and make it work.
