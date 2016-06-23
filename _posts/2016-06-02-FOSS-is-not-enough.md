---
layout: post
title:  "OSS is not enough"
date:   2016-06-02
categories:
---

I've been having a bit of a mid-programming crisis recently and it has started to take the form of a tin foil hat. When you run `cat foo.txt`, how do you know it won't `unlink("foo.txt");` after outputting its contents? Or how about deleting your entire home directory? What is stopping your IRC client from forwarding all your messages to me? Or maybe it will change your text as it sends it? Why do we trust software and how should we gain trust from software?

## Read the Source Code!!!

I know, I know. I should download the source, read it front to back and make sure it does what I think it should do, and stop writing a stupid blog post. I can do this for `cat` because:


1. its source code is freely [available](http://www.gnu.org/software/coreutils/coreutils.html)
2. it is written in C, a standard language
3. I can read and understand C
	

And this is one of the cornerstones of why open source software is important, regardless of its cost or licensing. But being open source only covers the first of those items and is only feasible for programs of a reasonable length. It is simply not scalable for users to necessarily read the entirety of a programs source code in order to trust it. While this is obvious for much larger programs than `cat`, it becomes more of an issue when considering all source code which `cat` depends on: the compiler you use, the syscalls it uses, which version of the kernel it interacts with, etc. Once you consider all transitive dependencies, my reading list just became a little too long for my liking.

## Which Language?

Suppose `cat` was written in [Brainfuck](https://en.wikipedia.org/wiki/Brainfuck), would reading the source code be of any help in increasing my trust of it? Definitely not; this would be as helpful as reading the compiled binary (probably less helpful actually). What happens if you write a unique language for each program? I then have to learn the language (by reading *its* source code or otherwise) and then read the program. Even if I can set aside days to disassemble and read machine code or learn new languages, what about the people who don't even know how to program at all? Do they simply have to trust some programmer when he says, "No sir, this app will not steal all of your money!"? 

## OSS Falls Short

I don't think open source software is sufficient for trustworthy computing. Besides it being insufficient, I read enough code in a day and I hardly want to have to page through every program I want to run. The Free in FOSS is even more useless to me for gaining trust; I don't care about making modifications and paying a license fee or whatever, I just don't want Skype erasing my pictures. I don't see machine code as fundamentally not open source (though it may be inconvenient!) and so we need a way of gaining trust from a much more basic level.

## Sandboxes, VM's, OS's

Web browsers are a very visible application of sandboxing because we (sometimes) want to load Javascript from a random website and run it. Normally, running arbitrary code is considered a bug, but here it is supposed to be a feature. While browsers are (mostly) successful at containing a website to a sandbox, they may be doing things we wouldn't like to happen. For example, an ad tracking service may record and phone home every keystroke, mouse position, etc. when you visit your favorite "news" site. I can (and usually do) take the total defensive (read: tin foil hat) position by disabling Javascript everywhere and only enabling it when I definitely need to. This works fine, but is a symptom that the sandbox is too permissive. Browsers do disable things like webcams and microphones by default, requiring explicit permission requests by the application (and subsequent consent by the user) to utilize. This is better, but still too coarse, much like a mobile OS.

Mobile operating systems seem to have taken permissions like these to heart and require all apps to request their permissions upon installation. This provides the user with a list of scary items it has access to, like GPS, contacts, microphone, etc. But what's missing is a permission like, "Yes you can use my microphone to do offline speech recognition, but no you cannot record and upload it". One answer might be to disable access to uploads, but what if a benign feature needs to upload something? Or perhaps the answer should be to split the app into the smallest pieces which are trustworthy. But can we verify that trust composes? It would be easy to exfiltrate the recorded sound as the input to my next "trusted" app for uploading. All paths point towards permissions being too coarse, as the desirable behavior is a small subset of all programs adhering to the given permissions.

Stepping aside from trustworthiness for a moment, I would like to comment that only allowing a program to do the absolute least amount necessary is highly desirable for programming as a whole. As a programmer, I would sleep easier at night knowing that the code I deployed to EC2 yesterday doesn't accidentally spin up 1,000 servers and cost me over $9,000.

There are some tidbits in SELinux which are along the right path like being able to specify which programs can access a file. Do you not shudder at the thought that any program you run may or may not read/modify/delete your SSH keys? SELinux can let you limit which programs can access certain files (among other things in which I'm not an expert). Yes this seems dandy, but I don't think its a proper solution because you now only have trust at the layer between program and OS. I want trust to start *inside* a language, between libraries, and between my own functions.

## From the Language

All of the techniques above use some form of nanny to keep watch over a running program and slap it on the wrist when it does something bad. I would much rather have decision procedures at the language level which could reason about all possible executions and determine the security properties of a particular program. Now of course, this will likely be a costly analysis to perform, but (a) security is important and (b) you can always fall back to doing the nanny approach. This idea of punting on a compiler if it takes too long and instead performing checks at run-time is something I'd like to expand upon in a future post.

## Conclusion

Ensuring program security by mandating source code transparency is a social approach which is brittle and easily beat. Furthermore, human processes like these don't scale and are not fit for the future of computing. We need security by construction.
