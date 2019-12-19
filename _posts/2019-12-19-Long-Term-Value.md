---
layout: post
title:  "Long Term Value"
date:   2019-12-19
categories:
---

I don't have a coherent thesis here yet but this is a taste of of something I've been thinking about recently. In the software world, we pay to keep old features and get new ones for free. This is backwards and symptomatic of many of the hair-tearing complexities we have surrounded ourselves with.

My basis for this came when thinking about RHEL and how companies pay big money to use software with some assurance. "If it works today, I want it to work in 7-10 years" and here's the money to make sure that happens. This is all predicated on the fact that we can never reasonably produce software that is perfect. There will always be something that wasn't accounted for and needs fixing, updating, patching etc. Red Hat makes their money making these changes with the agreement that it fixes the bug, but doesn't break the user (or at least I think so, I'm sure something must "break" someone, since that could mean a lot of different things in many different cases). Customers have obviously found value in this proposition whether for the pure business reasons of paying it down to lower your risk or technical reasons of "If I don't have to change my application code, that's a win".

Importantly, and something that I appreciate more and more these days, RHEL customers get a legal contract that they can take action on if something goes sideways. As compared to the open source licenses with "no warranty no this no that no nothing" that say "I have no faith this software does what I think it should" (and "faith" is totally the right word here). The huge number - and always increasing - number of services being built on towers of software with no guarantees is dizzying to consider. If things come burning down, there's nobody to point the finger at.

Whereas if I want some new features of a new kernel or package or library, I can run any distro of my choice. It comes for free, but it's free because there is no backing entity. You're gambling.

Of course I've glossed over one major point so far, which is that software has to change (or at least that's the accepted wisdom at this point). Whether it's for new features, bug fixes, removing unprofitable services, changing your GUI icons, software has to change. If I'm going to pay software developers to work on some code, can't they just fix things as they come up? They can and they currently do, but it requires work proportional to the size of your codebase. So if you want to grow your product, you *must* grow your team with it in order to have roughly 1 developer for every X thousand lines of code. These days, that calculation should be more like 1 developer for every X `lines of code × API's used × languages used × config file formats used × cloud providers used`. The point is, in some hypothetical world where once you wrote code it could live there forever (or maybe with a log(N) maintenance cost), 1 developer could continue to grow a product at a fixed rate.

It's really worth keeping in mind what "maintenance" means as you're programming. This isn't a car where you have to change the oil. What exactly are we "maintaining" and why is it necessary?

What would it take for a brand new programming language to catch up with all existing software products? I think if you can change the economics of resources required to grow the amount of software, you could reasonably do so. Keep in mind that most software has no intrinsic value - it's price is dictated by whatever market it serves and what those players are willing to pay. Compared to other products/services where the price reflects close to the floor feasible to produce something, software - even with competition - stays well above that floor (presumably because you can have a team of 100 developers serve 1 million clients). But if you had linear cost to develop software, you could race the competition to the floor and always win. <End of grandiose talk>.

## Programming Systems

How can we design a programming system where we are confident in: a) their behavior today b) their behavior as we change parts c) their behavior in 10 years.

I'm not saying programming "language" here because I think the language and library split is perhaps part of the problem today. Isn't it odd that we call them languages, but you can have two libraries written in the same language that don't work (or work well) together? Its like they're not talking the same language! Imagine a language with the biggest "standard" library (there would be no other library, so I'll just call it The Library from here) you can and where does that take you. I know people say standard libraries are where code goes to die because everyone depends on it and then you can't change it, but that's really a shortcoming of the language/culture itself and can manifest itself in any library you use. A new language with attention to change should be able to grow, change, and modify code in ways that we don't really see today. And no, I don't want a "tool" for language X today, because it has to be used by everyone; it has to be part of the common language that we've all agreed to use.

A major challenge is API design, how do you accommodate a huge variety of use cases in The Library? You have to be able to turn knobs when you need to without major rewrites. This becomes especially prevalent when you want an "easy" function to use that performs a whole pipeline of functions (maybe some data analysis and then returning statistics and plots), where each inner function has knobs of its own.

## Closing

I think there's a lot to unpack and I've only just started to myself. You can really fall down the rabbit hole when considering a full-stack approach down to the CPU, instruction set, firmware, etc.
