---
layout: post
title:  "Data Formats"
date:   2018-02-15
categories:
---

I've been brewing over some data formats lately and have some quick thoughts.

# Readability

Worrying about readability is downright silly. Its time we put aside concerns over being able to edit a format with our glorified typewriters in your text editor from yesteryear and see where we end up if we let that limitation go. Images, videos, and audio all get their own binary formats and we've built tools for manipulating them.

# Encoding

Encoding is the first scary step in using a data format because we want assurance that the data format will represent whatever value we give it "reliably". Reliability means no truncating long strings, losing precision on floats, etc. where the encoding is lossy. A data format should be able to be re-read by the same agent that created it (ie. if they encode a datetime as a string, they know it should be parsed in this datetime format and rehydrated as a datetime) without any information loss.

# Decoding

Decoding is the second scary step in using a data format because we want assurance that we can recover the original sender's message "reliably". Here, I am assuming the decoder is removed from all side-channel information in time and space and all they have is bytes in front of them which is claimed to be in AcmeDataFormat™. This means we either have to concatenate a schema with a blob, reference to a schema with a blob, or interleave a schema with the blob. In super special scenarios you could omit the schema assuming you have two agents under your control and some side-channel to ensure they are talking the same language, but I don't think that's very great. I don't get the fuss people make around the schema vs schemaless distinction.

# Schema

Whether your schema is interleaved with the blob like JSON or out of band like protobuf, you must have a "map" of your blob in order to decode it. When your data is very uniform, your map is simple and when your data is very diverse, your map can be complex. A schema/map forms a model over your blob and must be general enough to include each value. There are infinitely many schemas to describe a blob (in the schema language I am imagining) and those range from the most precise (there is no blob, all the information is in the schema) to the most general (the following blob contains X bytes). We obviously want something in the middle, roughly where the size of the schema is "just right" and gives us optimal knowledge over the blob for the given size of the schema.

## Compression

Following along from the above, I will give a few examples of what I mean with everyone's favorite data format, JSON.

Lets say I have the following bit of JSON

```json
[{"first": "Alice", "last": "Actor"}, {"first": "Bob", "last": "Builder"}]
```

Then we could factor out the repeated keys to produce a schema/map and a blob (though the blob is still JSON).

```json
[{"keys": ["first", "last"]}]
```

```json
[["Alice", "Actor"], ["Bob", "Builder"]]
```

Now we can factor by the common length of the inner arrays (we couldn't do this in general eg. if 1 of them had an extra key)

```json
[{"keys": ["first", "last"], "length": 2}]
```

```json
["Alice", "Actor", "Bob", "Builder"]
```

I'm hand waving over how these operations compose -- ie. do we end up with one schema at the end or a list of schemas that we have to apply in reverse to recover the original thing. Ideally whatever we end up with can be efficiently operated on, though this can also be a tradeoff that needs domain/situational input as well.

In a way, we are generating an ADT for the data we have as a way to compactly describe it. You can imagine the types would get pretty hairy for non-uniform things.

# Base Types

Data formats have to make a choice over what is universal to all participating parties; *some* things has to be agreed upon up front.

# Extensibility

After a few years, people will have new needs and if you build a language around a data format, you are going to be SOL if you can't adapt. Extensibility is a hard problem but I think it can be managed with UUID tagging data. Remember, all new data has to be one of the base types at the leaves, but it is important semantically to be able to distinguish otherwise structurally equivalent types.

# References

Most data formats ignore references and I think this is a major shortcoming. References are a (seemingly) fundamental semantic tool and without them we resort to encoding them in a fuzzy way. Perhaps it is sufficient to use a UUID tag as from above but I think they will need special enough handling that they will get their own atom. If there's one thing I think we can all agree on in programming is that dealing with change is hard and our attempts to manage it are gross bandaids. And you know how change is; it never changes.
