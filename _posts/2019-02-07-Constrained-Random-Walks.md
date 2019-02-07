---
layout: post
title:  "Constrained Random Walks"
date:   2019-02-07
categories:
---

I've been playing around with a few methods for generating "interesting" tessellations. The properties I'm looking for are

- irregular (not all the same shape)
- majority non-convex shapes (squiggle back towards itself)

Initially I was approaching the problem focused on the shapes themselves, but quickly realized that was unsuitable because every shape's edge is also the (partial) edge to another shape. Instead, focusing on the lines themselves essentially cuts the number of edges in half, though you do have to walk the edge graph to recover a shape's perimeter.

My general approach has been to generate a random set of points, disperse them with a few rounds of voronoi, and then generate an initial tessellation with a voronoi diagram. From there, the goal is to reshape the straight lines into a more interesting curve.

For reshaping straight lines, the constraints are:

- maintain end points
- no intersections with self or other lines

The two ways I see of approaching this problem are:

- geometrically - lines + bezier curves with some computational geometry for intersection detection/avoidance
- computer science(y) - grid of pixels

I have some good results from the former but wanted to see what the latter would yield. Even though the end result can't be pixelated, it should be easy enough to recover the path of pixels and apply some smoothing if they're too bumpy.

For pixel paths, I'm only considering 4 neighbors (NESW) and you can't create a solid 4x4 block anywhere (that makes recovering a path ambiguous).

To get started, I wanted to mirror the functionality of reshaping lines like before. And so given a straight (currently only applicable to horizontal lines from L to R) line, what paths can you take from the start to end with a given path length `L`? Here are the paths for L = 1..10 They are grouped internally by the gap length which is the number of pixels between the start and end points. (code is [here](https://gist.github.com/aconz2/717ed5b92d89e27b2cab7ea2356464aa))

Aside: as much as we all grumble about css being uber complicated, `image-rendering: pixelated` is a pretty neat thing!

<div id="random-walks">

<!-- note this style won't actually get used in GH markdown -->
<style>

img.walk-image {
  image-rendering: pixelated;
  width: 50px;
}

</style>

<h2>L = 1</h2>
<img class="walk-image" src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAQAAAAICAAAAAD7WAHZAAAAG0lEQVR4nGP8z8DAwPCfgeE/438GBgYmBhwEAIV/BAkWUtWOAAAAAElFTkSuQmCC" />
<hr>
<h2>L = 2</h2>
<img class="walk-image" src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAUAAAAICAAAAAAUmmrnAAAAG0lEQVR4nH3EMQEAAAjAILR/59lADiYQmmB9H6CYBAkpnw+2AAAAAElFTkSuQmCC" />
<hr>
<h2>L = 3</h2>
<img class="walk-image" src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAYAAAAICAAAAAD/rdHkAAAAHUlEQVR4nGP8z8DAwMDA8J+BgYHhPyOEx8RAkAIAu7EECZP9H0cAAAAASUVORK5CYII=" />
<hr>
<h2>L = 4</h2>
<img class="walk-image" src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAcAAAAaCAAAAABecRlKAAAAMElEQVR4nKXMMQoAIBDEwNnD/3/5LATBRhCrQAhJAyWCIpDtTw6hKfrW/XLd9et/AvB+CC149/KUAAAAAElFTkSuQmCC" />
<hr>
<h2>L = 5</h2>
<img class="walk-image" src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAgAAAAuCAAAAAAwkQd8AAAATElEQVR4nK3PQQqAQAxD0Zcy979yXVgUXDggdhVo2vyknVMSQWmB3KunWISmRG/MJeS62ptzYszrV4wYDL3DWIOsTMNXjH+EiehvWQchbhNYOh988wAAAABJRU5ErkJggg==" />
<hr>
<h2>L = 6</h2>
<img class="walk-image" src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAkAAABgCAAAAADqAQdeAAAAhElEQVR4nK2T0Q4DIQgEZ4j//8v0Ack1bVK59Hwi6GZnUU32CsRdXb3dwrdz39VCyN3Lz93f2ucrrSRBZvGf6Nn8gRb/iVlpDxx4BFoHg6RMjlTSVOSAanWMUuCEqrK320zhpTjnCMRLMcohlXxBMsixelQEfem3XqyTWT1b9T8h//F9Adp/Kcr45zUXAAAAAElFTkSuQmCC" />
<hr>
<h2>L = 7</h2>
<img class="walk-image" src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAoAAAC4CAAAAAD/WyIfAAAA50lEQVR4nLVVyw7DMAyCqP//y+zgR9xuB9qpPUWRIRgSl0J9CySYS+1d5CY4a38tD4AI6AKKYxXeYFggWkPjFmRrODOclT1iYBcwO7IYODTo2tA9J7md7FwMBmJnIX0VeAwtXcMSPWQYBfQY3lqmO1RqCJ1OLFVbDF4XZN4pChWMaR+rNr20ROYRGYAl8ujWYhKYsBU3PWsJs7eAccDM3gh1WHW7zOfUlgi2JaVsgZDv5Pnx0nUSiBNvj6s4Yug1p9yAuU5Sfbn8iXhkPwHLF2fDIgDID+Ay+7wAvgaem9s7y/0P1v8aPkLkY4C1zEn9AAAAAElFTkSuQmCC" />
<hr>
<h2>L = 8</h2>
<img class="walk-image" src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAsAAAG0CAAAAADBLILuAAAB/ElEQVR4nLVXS5IqMQyTUrn/lf0WiT9pmMIKj15MBSZWy39BQzwDJOhnxH8m/FuAx/2/zicO8w4dtYMzQTiNAZjlHYnPBMObAVjhFuZNv8A3tiMhb3Ai0BdxBj/eUWOVwRqZriOPX+ZOitVL7j7c78Xt12dGA4x0fd1hn+dEJmMA4f3MlPb7MfnUmjGFzxPnwfMep/SCV1x/zlQ+UW9ijR1xZtZb1n+/dzJfVnD80XswkzRKL9zhVD5s49T7AzG6Vm1f1/PR1/Hhhk9+b0HuCifq0NQ6RNZhjbm+FwqfeG72woHDinPtF9z2Gz51VkxRDzz5MGtbxiGTz1mHfZzX3fQ60y76InyZZd/p84dl/tzgVA0QMbf7+XNqCWX+7H1nG9Pe9cidJik4/0eXQvbr0KXJx1Q+7/VtfPhaa1HZF789ez3QnM/i3e01vx840PIe791lINgSxdba7813BQfR1oD8Y2ZdfeWTm951ir97jbpt31+urKTtynJ/lmasDFKsnOeaw1qco3tcigpxBoInHUOwZbVV4mzZOzHU2rZZ/5KuCP1gzkHKUfi4dpyUo+d+pGa7L5q3Uju/wPbxTjstntV3QXdVWyW/URGqbpygZQ9q2ix+21rqH20+L6Nty9wRLduqMdjtwaoHpu9xbU6GLYWd8utz+YnfrPPP538FjgiW/O/kpgAAAABJRU5ErkJggg==" />
<hr>
<h2>L = 9</h2>
<img class="walk-image" src="data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAwAAAOsCAAAAABb6ghIAAAEVElEQVR4nM2awY7kMAhEIfL//zJ7sIHCSbQp3FptH0aTifO6MBiwM2qSn0tURdUvTNTijpisG/nXdef1YqOJPzdEAsbR4sJeh/HoJcf8jkqarWKk2WMKCJoY0thJHCBt0l6e0bxgZlTCPzClA+awT3NEMaEXOxA8x9qGpEsnzSFdbQr+oWlj6rLQhpNIWzog9uQSMSu0lrZCy2E5owytJhTQZh1tj+npElEjtc2lCXIg81kn81UaCE2rORoYB3e2NNhIqkVoSdGdZVaElmFVdU/oX4f9XHXiOuvnhtYyDKK3pVqLant5ppFDSjlUxaCg18JWDhXLYZf2XA61PJO8XyTi07qtKBS0lWd+kZVfnvlFUn1pPdroMuzxe36Dfvyez8vs31wsn05VA2JvDWMrrWT4zTvRPfX6xMhjpRxOZ9GVdqPtqg9pddEaQ5uBpD5vZoJ9fCMFVC9o8QLd70AinQn/wKf7lif9OHtlrlt/ovkwVfGZo7r19Gmpc8bG2+YFMG71IVSE3LXBsFTap9UNVEObFm3hkt7uHbXFp717r7TcjjW9oEVb1O0faNOirbFzLdoUFgZLG+sAwjOSxLLvtPtPTYmuO+CSZn7Tkt/4Il7zWzaKV58WU6WY38QO89t2QETmN9+kmKNNQFt8Do6bkEZbeqP5MBVpWVq6dQVt1tFWaaDNjrUVS5WtWSK5mACta2EZp63UrFRX/NPRdmV2m4DA9WmQNhqZXCBbQnnunLvc5m0/mSO7wZKRIGCvhhf2XXUGbPN8dNmacgKQ2aVPS582402LtvBp7/SraNOirTNvqE1RW4emxVJD2pml+Wkfa1VadjXHPpUAHGsr277+WkBtWrQd+HSIyOmbhzSvNKfNNw8SlpaE0qZpodVsSdGGqEVYDZEsqHt6+kgTrM65sS+bh05d8KMWv5OIg0Oy1MbvT3da6cnpCnijPW1FOhVwbDWrMW+1AmJPLnbYk6sWsw97cmjqr56lWPQUe3Kxw558P0E/68kVe3Kxw548Xbpox9qKpVxP7udinpFyqsqwzuuBS8TQp8L7FGj3lw20T2/ZEssh7dM7DYbRPr1nchzW8GnNvVDA+FV/p+Uw61i61QWgHVuadyTXyX/5HkPmm4ylbUplSrU/kzThV1YqWAFIAlQQYIwC+NKU0wDYfHT9NDN2zcUceLYhATkHvog5ALieDNjcFRja0wBM1bs93wEx//PHdy9cnptcdZQjMgWE6qgZHCC9EKmYfCGGgFYHmW70YGIB4UacEAKwzN4m5DtgDTZHcXEgImG2BokEaAGQcRDO6xwQjejsEkDGgf8jZQBaTbBEIEVmZwEeSDMQqTjAeaszSgB83uqMfgf4WIvUxETi/EUFZ1SYSJzDC4CIRD8PKQAyEjOPdU6yBi6AzgGRH3QkwJ8j9yUOiC6JBpgkQJUJpIedEbcW7tsXci3ArmBEd8zXxgAo2eL8qwto3OX7Ov108QcKtWrlzmV//gAAAABJRU5ErkJggg==" />
<hr>
<h2>L = 10</h2>
<img class="walk-image" src="data:image/png;base64, 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" />
<hr>

</div>
