---
layout: post
title:  Container build system
date:   2024-03-14
categories:
---

Not a build system for containers, but a build system which runs containers

Run a container on a machine in some configuration with these inputs, save the outputs and metrics.

Run({container,vm,baremental}-image, {runtime,supervisor,machine}-requirements, inputs, outputs)

machine-requirements could be things like num-cores, mem-amt, cpuid, baremetal, vm, netaccess, bandwidth, tmpdisk, gpu

disk is the bane of this. can have scratch space but really want to avoid persistent disk.

metrics are things like wall clock time, execution environment (kernel, hardware, etc.)

Run a DAG of these programs. Executor seperate from scheduler.

job description can reference the output of another job as an input

initial focus on --net=none containers, but will want lower level testing later

want a live image for thumbdrive to create a new worker. put all the old computers online

for full control, have a microcontroller acting as a bmi and external power+ethernet switches. can then execute user code without network

inputs/outputs are hashed so we can cache

inputs/outputs might go to/from presigned urls, could even pass open connections to the container: eg just write to fd's 4, 5, 6. this means job can run without network but we still send the results out the network

predeclaring outputs is annoying but nice, but what if you have variadic number of outputs. Like `[tag(patch) for patch in img_patches(img)]`

Initially only for mostly trusted programs and workers and no privacy

DAG description is a json thing like

```js
{
    version: 1,
    jobs: [
        {
            id: "j1",
            container: "sha256:abcd...",
            env: ["foo=bar"],
            command: ["/usr/bin/bash", "..."],
            inputs: {"in1": "sha256:efgh..."},
            outputs: {"out1": "fd:0"},
            net: true,
        },
        {
            id: "j2",
            container: "jobs:j1/out1"
            env: ["foo=baz"],
            inputs: []],
            outputs: {"out1": "file:/tmp/results.txt"},
        },
        {
            container: "sha256:ijkl..."
            env: ["foo=buz"],
            inputs: {"fromj2": "jobs:j2/out1"},
            outputs: {"out1": "file:/tmp/more-results.txt"},
        }
    ],
}
```

An output description is similar to the exit file that OCI container runtimes produce (eg how podman gets the exit status and exit time) but also includes the outputs

```js
{
    job: {...},
    inputs: {"in1": "sha256:abcd...", "in2": "sha256:cdef..."}, 
    outputs: {"out1": "sha256:abcd...", "out2": "sha256:cdef..."}, 
    machineinfo: {...},
}
```

The output description also probably needs something specifying the output locations, probably object url
