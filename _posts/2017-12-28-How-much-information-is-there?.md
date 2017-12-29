---
layout: post
title:  "How much information is there?"
date:   2017-12-28
categories:
---

Disclaimer: as I've been writing this, it's become a zoo of random thoughts, so read-on at your own risk!

# Prelude

Recently, I've been thinking a lot about the representation of knowledge. I got there from a path that started with a work problem dealing with (simplifying here, but you get it) 3 APIs, each of which uses a different name for someone's personal cell phone number in something like their JSON object: "Cell Phone", "Mobile Phone", "Communication: [{"type": "cell"}]". And you can imagine that other companies might use "cellPhone" or "cell_phone" or who knows what else. I work with businesses on many tasks like this to integrate these APIs to keep them in sync, trigger actions, etc. and it is a hard (and valuable) problem because there are a lot of considerations when moving data between providers along with mapping fields.

My dream is to sit down, bring up two API specifications, hide those that are referring to exactly the same thing and then for each remaining one, sit down with the client and write a pair of functions that translates between them. In some cases, they might already be referring to the same thing and then I (or hopefully an end user at some point) would just have to assert that they are indeed the same thing and the mapping is already 1-1.

You can probably guess that I've been re-reading everything I can about the semantic web, ontologies, etc. and I am saving those for another post, but yes I still think ontologies could be extremely valuable despite how little they seem to have caught on. Anyways, what I'm really concerned with in this post is how many bits do we need to represent data that we care about?

# Information vs Knowledge

I'd like to propose a differential on information vs knowledge as the former being a bitsequence and the latter being something useful (very loose definition of useful). An HD 24 bit color depth monitor always displays about 10^7 (`math.log10(1920 * 1080 * 24) ~= 7.7`) bits of information at you and at 30 FPS, that is 10^8 bits per second. That is 100 Mbps of bandwidth. If we knew how much information it took to transmit knowledge, we would get an upper bound on how much we could learn from a computer screen. The really weird thing though that I'm realizing is that as I sit here with a laptop taking up 1/20th of my field of view, my brain is being bombarded with information from the rest of the room; but if I shoved the laptop to my nose, would my whole brain receive less information (since the laptop is a constant). Is there conservation of information consumption?

And so how much information does it take for us to learn a new fact or gain a new piece of knowledge? How many bits does it take to represent knowledge?

# Knowledge vs Observation vs Fact vs Belief

I prefer using observation or belief over fact because they are less absolute.

Are observations the same thing as knowledge? I tend to think of knowledge as something that generalizes a set of facts. In computing terms, I think knowledge is therefore a compressed representation (like zip) or even a program which could generate all reachable facts from some set of seed facts.

# Communication

As data sets grow with our needs, we will face bandwidth issues. It is therefore critical that we have ways of communicating without sending all of our information because surely lots of it will be already available to one of the parties (or if not readily available, then perhaps more available than the other party). I'm therefore very interested in protocols in the design space of total information size & RTT that will synchronize two party's fact tables (so to speak).

The other very interesting space is in lossy communication, where the parties have some common understanding and communicate in a way that discards information, but (hopefully) has a unique (or perhaps just good enough) value that is recovered. This is what human languages do and I think that investigating ways of coming up with an information space to embed very large pieces of information in a way that is recoverable given knowledge on the chosen space would be cool. And maybe a net win depending on how far you crank the lossiness vs ambiguity vs time to recover the original message. I'm not even sure if this is possible. The essence of this idea is JPEG for arbitrary information.

# Storage

The more you believe something is true, the less you have to remember new evidence that also shows it to be true.

# Closing

It is late and I feel like I never actually talked about what I set out to. I'm really trying to get at the Kolmogorov complexity of human activity: books, Wikipedia, movies, Reddit comments, DNA samples, source code, etc. And what different forms could you store it so that it is maximally compressed. Ie. would it be a net savings to store a movie with the raw clips + Adobe Premeire + the project files + Windows + CPU design and then just generate the actual movie on demand.
