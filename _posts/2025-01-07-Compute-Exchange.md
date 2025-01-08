---
layout: post
title:  "Compute Exchange"
date:   2025-01-07
categories:
---

One idea I've had kicking around for a bit is something like a stock exchange but for compute. Buyers (users) submit a computation with resource requirements, a container hash, and a price; sellers (providers) submit their computational capacities and prices; the exchange does some matching and does the money things.

This is one possible future for the stuff I'm doing with Program Explorer. I'm slogging through the last 10% until I have a v0 public release for that so maybe writing down some of these ideas will help me get there.

I don't have a tone of prose to elaborate in a straightforward fashion (as if anything I write is here is straightforward) so I'll start with bullet points and that will either turn into a bigger post someday or stay a list forever.

* cloud providers each have things like this to run containers, for example AWS ECS or lambda, Google Cloud Run
  * they don't have a uniform API
  * they don't support all the hardware configurations (like memory size caps) they offer for dedicated instances
* cloud providers each have spot instances with a bid price
  * your instance can be interrupted (with warning) so you need logic to support being interrupted
  * you can't place one bid between two providers and take the lowest/first (I think there are 3rd party versions of this)
* there are only a handful of cloud providers, is this useful? would they adopt it?
  * they wouldn't initiallly because they are happy having lock-in
  * I think there could be way more cloud providers than the big few and having a way for buyers to use them without even knowing who they are makes it possible for them to start getting work
* how can I trust the provider which gets matched with my job is trustworthy
  * idk hard problem
  * part of exchange duties would be to vet providers
  * lean on combination of TPM, attestations, SEV, etc.
* right now the price of computation is set by some finance people at big cloud providers in a static way
  * this seems incredibly hard to get correct, or incredibly easy to over-price since you don't want to lose
  * maybe they rely on bandwidth costs and stuff; wish I could look at their numbers...
* the price of computation should be a fluctuating thing, just like a market
  * the price of electricity can change and will continue to change
  * the price of a FLOP/INSN (instruction count if we're not AI focused on floating point) is changing all the time
  * the geopolitics and business politics of whether/when how expensive every next gen of chips puts uncertainty on future pricing
* there is a huge amount of old/older compute on the secondhand market
  * hard to price the value of the equipment currently because
  * with exchange data, could price the equipment based on compute/watt
* users care about some combination of price and time
* estimating resource requirements is a hard problem for users and developers for known containers
  * don't want to overestimate memory or cpu otherwise we pay too much
  * users can't be expected to know when they create a job how much they need
  * developers don't always know a good rule of thumb or close overestimate, but sometimes they do
  * one possibility is to have some metadata / standard on how to invoke a container with the input files in "resource estimation mode"
  * another is to have a mode of "elastic" (though would AWS sue you?) execution where providers are expected to be able to migrate you around if you need more memory (up to some limit)
    * doesn't exactly help with cpus, but you could also imagine an API for "hey please give me 10 more CPU cores" which would be kinda cool
* some containers are public and providers could easily pull/cache them
  * I think cloud providers like to make you put any containers you want to run in your own registry; this does make sense but is also a pain
  * others are private and would require access keys to a registry (goes back to trust of provider)
* where does the input to the program come from and where do the outputs go?
  * presigned urls from object stores (hello semi-standardized API for storage, where are you for compute?) are nice, but are per-object for reading or writing, so doesn't really scale well
    * ideally there would be presigned url for reading from a list of objects and/or prefix and writing to a prefix
    * one presigned url per output object is again bad UX b/c the user and/or developer need to know upfront how many outputs we produce
* where can you view the status of your computation?
  * maybe exchange manages this
  * will need to keep record for money stuff anyways
* this is all with the idea of batch type computation, can it work for services
  * much much harder
* if my data is in S3 but my job gets matched to azure, will I pay a fortune in egress?
  * yes
  * buyers likely need constraints they could specify, but having the exchange do something smart here too would be nice
  * hopefully we could somehow do away with egress costs one day
    * in some ways they are legit b/c it costs a X pJ/bit/mile or whatever, but again if it's a fixed price, then it is not getting priced accurately
* what about GPUs?
  * yes those are important
  * this is where it seems like there are actually more successful small providers already
* what about batch jobs that expect to communicate and care about locality?
  * ideally the hard problems of scheduling with constraints could be centralized in the exchange
* providers could ideally just netboot machines from an exchange-provided OS (or custom if they prefer) and start collecting money
* all resembles some kind of mega job/cluster scheduler and job/workflow/DAG scheduler
  * maybe exchange would support DAG definitions (see earlier post on container build systems); never really seen one I've liked
* how should a user decide whether to run on aarch64 or amd64?
  * multi arch containers should signify you don't care and run on the cheaper
  * non obvious tradeoffs in compute time and cost though
* if a job doesn't complete 90% of the way through a 1 hour job, who pays?
  * if it's a hardware failure, should be the provider
  * if it's a bug in the program, should be the developer (joke)
  * if it's a bug by the user, should be the user
  * would be nice to have checkpointing either at the VM/container level or some metadata on how to checkpoint a given container (what signal to send and what file(s) are in your checkpoint)
* how much batch computation market is there?
  * scientists
  * companies
  * lower than there could be because of how much friction there is to just run a damn thing
  * tool use by AI agents
* is container enough to specify working environment?
  * something might require a certain kernel version
  * support bare metal? need really secure root of trust to make sure user doesn't flash your mobo with a rootkit or whatever
  * some things like benchmarking would benefit from specifying specific CPU requirements
* what about disk space for scratch?
* can the provider cache files?
  * would be so nice to lean on a content addressable system here
* what is the exchange's cut?
  * fixed fee?
  * percentage?
* what kinds of fairness can you provide or need to provide
