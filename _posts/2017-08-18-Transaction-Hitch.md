---
layout: post
title:  "Transaction Hitch"
date:   2017-08-18
categories:
---

## **Warning to self**

I've been dealing with a bunch of bulk-clearing and re-inserting fresh data into tables recently. The codebase (inherited) was currently doing this with a commonly suggested scheme to insert into a temporary table and then doing two renames and drop (or not - in this case) on the old one.

This is good because it gives you an atomic transition to the new table. But its also a bit annoying when you're using an ORM and you either write some trickiness to do this to create a cloned class with the temp table attached or - in this case - have a lot of copy-pasted code.

Those reasons aside, this also bugged me because some part of me knew that while the rename was atomic, you couldn't build a bigger transaction with this method.

Anyways, long story short is that I started to write some code that I thought was a much nicer idea, start a transaction, truncate the table, insert everything, done. If anything in the insert fails, the transaction gets rolled back and we're all happy. I tested this to convince myself it worked and everything looked good. The code looks like (bulk insert aside):

```
with database.atomic():
    Widget.truncate_table()
    for i in range(100):
        Widget.create(i)
```

And I tested this on my machine ... with a sqlite database. And production uses a MySQL database. And MySQL doesn't support truncate in a transaction. FML.

## Lesson learned

Use:

```
with database.atomic():
    Widget.delete().execute()
    for i in range(100):
        Widget.create(i)
```

## Thoughts

Databases are crazy, the differences between different implementations is crazy.

Using the same code with different databases does not guarantee even close to the same semantics.

I'm still thinking about how we might write code that would warn you against this.
