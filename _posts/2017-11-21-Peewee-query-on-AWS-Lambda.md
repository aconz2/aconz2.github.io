---
layout: post
title:  "Peewee query on AWS Lambda"
date:   2017-11-21
categories:
---

I ran into a nasty bug (though I think its more of an oversight/misunderstanding on my part) that was surprising and wanted to share it.

For one project I work on, we run a bunch of tasks on AWS Lambda. We are using [peewee](http://docs.peewee-orm.com/en/latest/) as the ORM. For the most part, I've been content with this, both Lambda & peewee -- both have their drawbacks but hey what doesn't.

Each of these tasks is deployed as separate Lambda and usually involves a few different queries to do something. Initially I was writing code like this:

```py
# Version 1
def gather_foo():
    return (
        Foo
        .select()
        .where(Foo.blah > 42)
    )

def gather_bar(some_arg):
    return (
        Bar
        .select()
        .where(Bar.something > some_arg)
    )
```

You can see that `gather_foo` is a "pointless" function because we can just write:

```py
# Version 2
gather_foo = (
    Foo
    .select()
    .where(Foo.blah > 42)
)
```

I give the `gather_bar` example to show that sometimes it really is useful to parameterize a query.

Anyways, I started writing queries in the style of Version 2 when I could because I think it looks cleaner (or some silly compulsion; regardless I did it).

Then sometime later our system was doing bad things and it came down to the system not reading its own writes. Most of these tasks just use the database like a queue (oh the horror!) by doing a gather, taking some action and then the next time it runs, we expect its actions to be visible. However, local testing showed that this was not happening and I could see in the database that the changes were in fact being made.

The punchline is that Lambda and peewee colluded in a surprising way. First, queries written in the style of Version 2 are module level variables. Second, peewee [will cache](http://docs.peewee-orm.com/en/latest/peewee/api.html#SelectQuery.iterator) the result of a query unless you use `.iterator()`. Third, Lambdas are loaded/initialized when new code is deployed and are then potentially unloaded and reloaded on demand. These three things together meant that the `gather_*` query is cached for as long as AWS decides to keep that Lambda laying around and so the next time it runs, the query hits the cache and we see stale data.

I can't really blame any of those things because they are reasonable choices. I'm most annoyed with peewee using caching by default because I think that's crazy, but it does and I didn't know it and now I do. AWS not reloading code makes perfect sense and is obviously a big win for people that care about latency, but does maybe take some more consideration because it is different from the process model you might be developing on locally.

The big thing here is how surprising the combination of two unrelated components can be. Obviously surprise is based on your current belief set so its hardly universal, but these are the kinds of things I wish we could guard ourselves from better.
