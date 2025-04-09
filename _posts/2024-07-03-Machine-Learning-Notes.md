---
layout: post
title:  "Machine Learning Notes"
date:   2024-07-03
categories:
---

WIP notes on machine learning, reader beware, mostly for self study but maybe there are useful to you too

---

### llm

Often we want to find some function f which fits some property, like if we have a dataset of inputs and outputs xi and yi, we'd like to find an f such that f(xi) = yi. Finding such a function isn't normally easy! Almost always, we have to settle for an approximation such that f(xi) "is close to" yi. There are many ways we can choose to measure what we mean by "is close to" and many ways we can measure how well we do on the entire task. These make up the loss function: loss(f(xi), yi) -> scalar and we commonly seek to minimize the mean loss across our dataset. Mean isn't the only possible choice, you might want to minimize the worst case loss, or weight certain inputs as more important to do better on etc.

What are the inputs and outputs of f? f : scalar -> scalar just isn't that interesting! So we quickly move to multiple dimensions and think in terms of linear algebra. We might have f : vector -> scalar or f : vector -> vector or f : matrix -> scalar etc. Ex. image classification of "is dog in image?" could be f : (1024,1024,3) -> scalar where the input is 1024 pixel image with 3 color channels at each pixel RedGreenBlue. (1024,1024,3) is called its shape. We can equivalently think of the image as (3,1024,1024) as 3 1024x1024 pixel images, one for each color. One natural choise of scalar output for the dog classifier would be positive values for dog and negative values for not dog and the distance from 0 could represent the confidence. 100 is definitely not dog, -0.1 is an unsure not dog.

Some data like language text needs to be converted into numbers so that we can compute on them. For basic English text, we could assign the integer numbers 1-26 for lowercase letters, 27 to a space, etc. There is a ubiquitous version of this already called ascii used in computers (the next most common is unicode in utf-8 likely, but there are tons of encodings). If we wanted to predict the next letter of some text of length T, our f : (T) -> scalar would take in a vector of the corresponding integers to the text we want to predict and output a scalar that is its prediction. In general, we work with real numbers (well actually floating point) instead of integers, so how should we interpret an output of 22.35? Do we round it, etc. Instead, we might choose f : (T) -> (V) where V is our vocabulary size and each entry in (V) would mean how much the model things the output will be the ith letter. A perfect prediction might be represented by a one-hot vector where the correct ith position would be 1 and 0 everywhere else. You can choose whatever output format you want, but one nice thing for a task like this of discrete choices is having the model output a probability distribution or probability vector where the probability in the ith position is the probability of the ith letter being the next letter. The sum of the vector should add up to 1 since it is a probability vector. One trick is that we can turn any vector (take the output of f) into vector with sum 1 by dividing by its sum, but there might also be negative entries so we also need to somehow deal with those. To do that, we can take e^f(x) since negative values get mapped to small values and positive to positive. So overall, we can do normalize(exp(f(x))) which turns whatever output we get from f into a probability vector, nice! normalize(exp(...)) is called softmax because it accentuates/amplifies larger values and diminishes/filters smaller and negative values. People call the raw output f(x) logits but I'm not entirely sure that is true to the meaning of logit (log odds or log(p/(1-p))).

Extending the idea that integers suck for modeling, instead of one integer per vocab character, let's assign one real valued vector of size C (channels) to each character. This gives us a matrix of shape (V,C) and now if we are doing next character prediction we want f : (T,C) -> (V) . To use it on an input, we take our T characters, lookup each character in our dictionary (commonly called embedding matrix) and form a matrix (T,C). We can call that a function embed : (T) -> (T,C). Then, we use the softmax trick to turn the output of f into a probability vector over our vocabulary. The whole thing looks like softmax(f(embed(xi))). But wait, our known output yi is a single character/integer still, what does it mean for an integer to be "is close to" a probability vector; in other words what is our loss? First, let's think of our yi as a one hot vector again which is also a probability vector. Now we can ask about what loss functions can we use to compare probability vectors. Commonly this is cross entropy which is -sum(dot(p, log(q))); it is the negative p-weighted sum of log(q). Here p is yi one hot pvector and q is our output pvector. Since yi is one-hot, the only nonzero term is at yi (the character), so the loss is -log(q[yi]). When computing this, pytorch for example wants the pre-softmax output because we don't actually care about the values at any index besides yi and so we can skip the division everywhere except at yi. So then it is like x' = exp(f(x)) lossi = -log(x'[yi] / sum(x'))

Okay, so we have inputs, outputs, and a way to measure how good the function is at doing what we want; how do we actually represent a good f? Let's consider a simple f for our next character prediction task (after embedding) so f : (T,C) -> (V) . Linear algebra tells us that matrices represent/are linear functions of shape (O,I) where O is output dim and I is input dim. We can apply it on an input vector x of size (I) with a left multiply Ax has shape (O,I)(I,1) -> (O,1). We can freely insert dimensions of shape 1 to make things work and (I,1) is I rows of 1 column so we call it a column vector. Generally matrix multiply has shape (M,N)(N,O) -> (M,O) and can be thought of as running the function from the left matrix on each column in the right matrix. What does the left matrix do? Remember that each entry in the output[i, j] is the dot product of the ith row and jth column (for AB = C that is C[i, j] = dot(row(A, i), col(B, j))). The dot product is a multiply component-wise and accumulate with sum: dot(x:vector, y:vector) -> scalar = sum(mul(xi, yi)) = l(x)l(y)cos(angle(x, y)). The second interpretation there is that the dot is also the product of the vector lengths (sqrt(sum(square(x))) = n-d hypotenuse) with the cosine of the angle between the vectors. When we have unit length vectors ie l(x) = 1 and l(y) = 1, the dot(x, y) = cos(angle(x, y)) so we get a scalar in [-1, 1] based on the angle between the vectors. We can interpret vectors as being similar/close if their angle is small, small angle makes cos close to 1. Orthogonal/perpindicular vectors will be at 0 (cos(pi/2) = 0). Vectors pointing in opposite directions will have angle 180 (cos(pi) = -1). So dot product gives a value in [-1, 1] and tells us a measure of how much the vectors are pointing in similar directions. Back to our matrix multiply Ax (O,I)(I,1) -> (O,1), A has O rows of I-vectors and each row i of the output is dot(row(A, i), x). So the matrix multiply measures the similarity of each of its rows with the input vector x. Our output vector (O,1) at each ith coordinate tells us how similar the input vector was to the ith row of A. Thinking of our f as a model of our input, we can imagine A as being a list of features we're interested in and Ax will check how much the input matches each of those features. In the general case AB = C (M,N)(N,O) -> (M,O), we are computing the similarity of each column of B against each feature in A. This is why we get shape (M,O) out because there are M rows of A and O columns of B. For next character prediciton f : (T,C) -> (V) we could conjure up two matrices P and Q and do (V,T)(T,C)(C,1) -> (V,1). Oh yeah, and matrix multiply is associative (but not commutative).

Okay, so we have a representation of f as P (V,T), Q (C,1), and E (V,C) (embedding dictionary), what numbers do we put in these matrices? Random! Yes we'll be lazy and just randomly initialize them. We can now run our function f on some input xi and measure the loss against yi. It will almost surely be a big loss, this f is bad, this is okay. Because now we can try to find a slightly better f by computing the gradient (grad : scalar -> vector) of the loss function at our input xi grad(loss(f(xi), yi)). The gradient returns a vector of derivatives, one for each parameter in f. The parameters (sometimes called theta) in f are the entries in its matrices. These derivatives are the partial derivative of the loss function with respect to that parameter at the value xi. The derivative tells us the slope of the linear approximation of our loss function (wrt each parameter) at the location x. The sign of the derivative tells us how increasing/decreasing that parameter will increase/decrease the loss. Picture a parabola x^2, deriv is x, negative x < 0 and positive x > 0, negative deriv means decreasing x will increase x^2 whereas positive deriv means increasing x will increase x^2. Since we want to minimize the loss, we update the parameters with the negative of the derivative. The magnitude of the derivative says how much we expect the loss to change for a given amount of change in that parameter. Or in a relative sense, parameters with a large relative size are currently affecting the loss the most. We can update our parameters in f by adding the gradient scaled by a step size theta' = theta + mul(step, grad(loss(f(xi, theta), yi))) and I'm writing f(xi, theta) to make it clear now that f is parameterized by theta. This is a basic SGD stochastic gradient descent. There are other optimizers. Our f is really a giant space of possible functions, one for each possible configuration/assignment of parameters theta. Each architecture of f will be its own space of possible functions. The architecture of f is the design of how we choose to multiply matrices and what other operations we utilize.

Where do these gradients come from? The computer calculates them for us! Remember all the rules of derivatives? You can sometimes use those to write down a closed form expression for the derivative of your chosen loss function with your chosen architecture and you can even do this by hand, but we have a great tool called auto differentiation which takes care of this and even works when there isn't a closed form expression. It does this by storing some information on the side for each operation that your model computes in the forward pass ie when it is running f(xi), then uses that information in a backward pass to compute the gradient at each parameter. So when we are in training mode, we typically require (at least) 2N memory for an N parameter model. With other optimizers, we may need more, like Adam (adaptive moment estimation) which keeps 2 persistent values per parameter in order to better estimate the gradient. It does this with an expwma. Q what is the second "moment" I kinda understand the first but not the second. We run this iterative process of testing how good the current parameters' loss is and updating them over and over again. The loss will not be the same on every single input in our training set, so it is important to train over all of them. One pass over the training set is called an epoch. One other note is that to make things go faster, execution is batched: we run multiple xi at the same time for a given parameter configuration. We then get a loss for each xi and an accompanying gradient for each xi which we can average together to inform our parameter update. Now we can observe that the training process is very dynamic: the order of training inputs and grouping of training inputs into batches will affect the parameter updates at each step and thus what parameters we will end up with at the end of 1 or more epochs. Given that models with well over 1M parameters are common, we will almost surely never find "the one true best" parameter configuration for a given dataset and architecture. Remember that gradient descent is a local update procedure, not a global one; we do not update the parameters in the direction of the global optimal loss minimizer, we update in the direction of the local loss minimizer. Optimizer schemes like Adam were created to avoid problems like getting stuck in a local minimum, where if we are only taking local steps to minimize the loss, we risk getting to a valley of low loss and never leaving, meanwhile that valley is actually at a pretty high loss compared to the rest of the loss landscape. Other schemes like weight decay unilaterally shrink the weights of all parameters (multiply each parameter by a scalar in [0,1]) to avoid overfitting, where sure we might find some configuration of parameters that perfectly fit our training data, but do poorly on new unseen (validation/production) data. Q: is there a selective version of weight decay that multiplies each parameter with its own scalar?

We now need to talk about nonlinearity, so first, what is linearity? Linearity is a property of a function which satsifies f(a + b) = f(a) + f(b). Multiplication is linear because for example c (think of c as the function which multiplies by c) c(a + b) = ca + cb. Aka distributivity over addition. The dot product is linear because (a b)((c d) + (e f)) = (a b)((c + e) (d + f)) = a(c + e) + b(d + f) = ac + ae + bd + bf = (a b)(c d) + (a b)(e f). This means matrix multiplication is linear as well. This actually presents a problem: the basis for organizing our model into vectors and doing matrix multiplies means we could only ever model linear approximations of our data. But lots (most?) of the interesting applications of machine learning are exactly to those problems which are nonlinear. So we have to introduce nonlinearity into our architecture to give them more modeling power. Also, as we build bigger architectures under the assumption that more parameters gives us more modeling power / ability to fit more complicated datasets, we need the nonlinearity to prevent our architecture from collapsing. For example, say you hear that more parameters is more better, so instead of having just one matrix of parameters of shape (V,C) for the embedding dictionary, you decide to tack on another (C,C) matrix so that we embed like (1,V)(V,C)(C,C). Well unfortunately, by associativity, we can precompute the (V,C)(C,C) matrix product to end up with a (V,C) embedding dictionary again. In this case, adding more parameters does not change our modeling power whatsoever. If you introduce a nonlinearity that prevents that matrix multiply from happening like nonlinear((V,C))(C,C) then that is a different story. There are plenty of fancy nonlinear functions commonly used, but the basic one is relu for rectified linear unit. The output of relu is simple: x<0 -> 0 and x>0 -> x; negative x is clamped to 0 and positive x is the identity. This function is nonlinear because by counterexample relu(-1 + 1) = relu(0) = 0 but relu(-1) + relu(1) = 0 + 1 = 1. In our previous example, we could usefully use another (C,C) matrix by embedding like relu((1,V)(V,C))(C,C). When applied to a vector/matrix, relu is applied to each element. And the derviative of relu, which we need to be able to update our parameters, is very easy: 0 for x<0 and 1 for x>0. It is also very fast to compute. In the context of matrix multiply, applying relu(Ax), which is the dot of every row of A with the vector x, clamps every negative dot product to 0 and lets all the positive dot products pass through. So any feature vector in A that has angle < 90 will result in a nonzero result in that position in the output vector, and zero everywhere else. This gives us an important building block for a 2 layer unit (C,D)relu((D,C)(C,1)) where the (C,1) is an input and we have a (D,C) matrix and a (C,D). Commonly D >= C and in transformers is always (joke) D = 4C. What does this do? Sticking with D = 4C, the first (D,C) matrix is 4C features that we get to check against our input and comparing with the dot product. We then relu these 4C similarity results so that only the positive ones remain, while the others go to 0. We then multiply with a (C,4C) matrix which has C features in a 4C dim space. Each of these features are "features of the similarity results with the first 4C features". The output of the layer is something like: compare this vector to 4C features, then compare those similarities to these C similarity patterns and the output is a vector which for each coordinate, says how much it matched the corresponding similarity pattern. You can go crazy by repeating this pattern of relu + matmul over and over again and we get what is called a multilayer perceptron or MLP and is where the deep in deep learning comes from. The relu (or other nonlinear "activation" function) prevents the matmuls from just collapsing into one matrix. Q: is there a fused relu-dot like operation? It would relu each pairwise product then sum. This would give you a modified similarity measure where it sums all the products with the same sign. Another related Q is about another sum after a regular relu(Ax) so sum(relu(Ax)) which counts the total "amount of similarity" between the features in A and the vector x.

We now have enough to look at the transformer architecture which is very popular in large language models as a next token prediction function. As we've seen, we have some context of tokens (integers) in our vocabulary (T) and we embed them into (T,C) using a (V,C) dictionary. We seek a function f : (T,C) -> (T,V) where each row of the output is a probabilty vector over each item in our vocabulary. Remember we can turn any vector into a pvector with softmax, so whatever (T,V) f might have given us, we can apply softmax to each row of (T,V) to get each row into a pvector. This is slightly different than our previous formulation of this problem where f : (T,C) -> (V) where we only returned a single pvector, what gives? Our new formulation f : (T,C) -> (T,V) gives a next token prediction for every prefix of the input. This is useful because a) we already have that batch of data loaded into memory, we may as well compute on it and use it to update our parameters and b) it lets us run the model on inputs which are less than T tokens long. Q: how useful are the gradients for the short prefixes? We can easily get training data for this function by just taking all the text on the internet and grab random sequences of length T+1, feeding the first T tokens as xi and the last T tokens as yi. Ex. T=4 "abcde" is our example, we want f("abcd") -> "bcde" ie f("a") -> "b" f("ab") -> "c" f("abc") -> "d" f("abcd") -> "e". Remember though that the output is a pvector over our whole vocabulary, so the target pvector is a one-hot V-vector ie the probability distribution with all probability on the single letter of our target. We can easily see this objective is complicated when there are more than 1 observed next tokens for a given input, ie we will have many cases where f(c) -> x and f(c) -> y. This means the model's output pvector in this case will need to put some prob on x and some on y to minimize its loss against all the training data (or in some proportion to how often they appear in the training data). For what follows, I'll mostly focus on the final next token prediction, as if we had f : (T,C) -> (V) because everything else is the same sans masking (later). So, the most important part of transformer is the attention step, where attn : (T,C) -> (T,C) ie it produces 1 vector for each input vector, but is a function of all (T,C). Contrast this to the mlp or feedforward network we discussed which mlp : (C) -> (C) which we are free to apply at each position so row-wise-mlp : (T,C) -> (T,C) but the computation of each output row only depends on the corresponding input row. Attention is important because it produces an output vector per position that is dependent on the entire input. I suppose we also need to mention that our architecture will be built in an additive fashion, where f(xi) = xi + attn(xi) + ... ie resnet style. This is useful because the grad(f(xi)) = grad(xi) + grad(attn(xi) + grad(...) so we get gradient contributions immediately on xi (right to the embedding layer), then some more from the attention layer and so on. I think also some argument about how the trivial solution for attn(xi) = 0 would still map f(xi) -> xi ie it would learn the identity at least gives the model a starting point. Whereas it would have "more to learn" if f(xi) = attn(xi) + ... This setup is also called the residual stream where we keep adding functions of the stream back into the stream, like f(xi) = xi + f1(xi) + f2(xi + f1(xi)) + f3(xi + f1(xi) + f2(xi + f1(xi))) + ... Another perspective is that we are treating f like the derivative, we want it to tell us, "what should I add to my input vectors such that they match the next token output vector". Okay so how is attn actually computed? We'll need a few matrices: S (C,C) V (C,C) and O (C,C) (note this is different introduction than the paper, we'll get to Q and K in a second). Our goal is to return a single vector (C) that is the weighted sum of the rows of (T,C) under the transform V, then passed through O. So take our input (T,C), apply V to each row (T,C)(C,C) -> (T,C), then take a weighted sum with a vector (T) and pass through O, so we do (C,C)transpose((1,T)(T,C)) -> (C,1). Altogether that looks like (C,C)transpose((1,T)(T,C)(C,C)) -> (C,1). We compute this weighting vector by computing the similarity of the last row of (T,C) with every other row of (T,C), which is where the "interaction" or dependence among the whole input comes from. We *could* compute this similarity using a dot product, but that is a bit too simple. So we use our S matrix (C,C) to compute the similarity (T,C)(C,C)(C,1) -> (T,1). Having the S matrix lets the vector transform before the dot product is computed. We chuck in a softmax on the similarity result (T,1) which makes it into a pvector and again nonlinear things can model more complicated things than linear ones. It also means the weighting values are nicely behaved in range (0,1). Altogether in my weird notation it looks like (C,C)softmax((T,C)(C,C)(C,1)(T,C)(C,C) or in symbols Osoftmax(XSr)XV where r is the last row. The original presentation of this uses two matrices Q and K instead of S where S can be thought of as QK (C,C)(C,C) -> (C,C), but I like seeing it as a single thing. The reason to separate them in practice is that we use multi-headed attention. Lets choose a dim (H) and a number of heads (N) so C = N * H, now slice up our O, Q, K, V matrices into (N,C,H) (still will have CC = CNH elements). Each head of attention gets the input xi and operates independently of the other heads. For a single head where Qi (C,H) Ki (C,H), we can still compute our similarity using the matrix QiKi.transpose (T,C)(C,H)(H,C)(C,1) -> (T,1). This is effectively a low rank (since H < C) representation of a matrix S, or another way to think of it as projecting the vectors into a lower dim H and then computing their similarity. The head will have computed the value vectors using Vi (C,H) in dimension H so (T,C)(C,H) -> (T,H) and after combining them with a weighted sum, we get (H), but we want (C). We use the output slice Oi (C,H) to map us back up into (C). Each head independently computes a vector (C) from the input xi and those vectors are added together. Using equally sized heads is conveneient for implementation. Q: where is the research on variable head sizes? I would think that distributions would be best represented with some specific collection of n1 heads of size s1, n2 heads of size s2, etc. where your goal is to use the smallest head size possible. Are our current heads the minimum size possible and we just expect deeper models to mimic larger heads? To return to the full case of (T,C) -> (T,C) our attention heads do the same process applied at each position, with the caveat that when we take the weighted sum of the value transformed vectors, we need to zero out the vectors that come from positions forward in time (so called causal and/or decoder / autoregressive). We can also choose to not do this (so called encoder) if we are interested in for example sentiment analaysis where we always look at the full text and only produce one output. Note that some of the dimensions above are a bit sloppy in terms of multiplying on the left/right w/ transpose or not. Also, I presented the QK as S but left O and V separate, even though we can view them similarly as an OV low rank factorization as well; this is the stance from the circuits paper.

Q: what is the relation between QK and a metric tensor? QK gives pos and neg outputs, so not a metric, but exp(XQKX) (transpose appropriately) gives only pos, though we still get something like inverse distance where small attention is like large distance. Though we can fix that with exp(-XQKX). And QK isn't constrained to be symmetric. My other wonder with QK is that I find it non-symmetric to think about QK acting to transform X on the right into X' to be compared with X^T and not more like X^Tsqrt(QK)sqrt(QK)X where now each side is being transformed "equally" to meet in the middle.

One thing to notice in attention is that because we take a weighted sum of value vectors, the result is permutation invariant. If we reorder the inputs (scrambling our input tokens), then the similarity weighting we compute with QK "follows" the new order and the sum of attention weighted value vectors discards any ordering information. This is weird because it means the value vector we add back into the residual stream is the same for "ab" as it is for "ba" assuming "a" and "b" are tokens. This doesn't match our intuition or so called inductive bias because we want the value vector result to be depedent on the tokens AND their ordering. So to do that, we add more vectors! We can either add a learned positional vector (one vector per position ie a (T,C) matrix) or some other computed positional vector dependent on the position of the token. Then we compute on xi+pi instead of just xi. This then means that "a"+p0,"b"+p1 != "b"+p0,"a"+p1. I think the overall goal is how they frame it in rotary positions paper, where we want dot(pos(u, m), pos(v, n)) ~ dot(u, v) * f(m - n) where we want the dot product of the positional vectors to be related to the dot product of the original vectors with some modulation by the relative position. I suppose in the general case it is ~ dot(u, v) * f(m, n) but I think relative position makes the most sense since we don't want dependence on absolute position, rather the relative position.

Q: if resnet (concept, not the og model) is so great, why isn't everything residual style? Like when calculating the result of self attention with V, why not do x+Vx? Well one reason is that with multihead, V downprojects so we can't do x+Vx. So then maybe I'm asking why not O(Dx + VDx) where we downproject, add with a function of the downproject, then upproject with O. Maybe also in the QK?

With all the focus on mechanistic interpretability for how do we reverse engineer why transfomrers/attention work so well in next token prediction, it seems natural to ask why can't we design networks that are more interpretable to begin with. One part of the interp is to try to isolate/identify modules/heads that seem to do a particular thing. But oh wait that is really hard because we can't even guarantee a head does a "single" thing or even if it does a single thing, the residual stream isn't forced to have an interpertable structure or even a non-changing structure between layers. So that all makes me think about how could you train attention heads independently. The training objective isn't clear, maybe it is the full task but we can't expect a single head to do that well, but maybe we can find the top N heads with minimum cross correlation or something. This is related to the idea of the task space having an inherent amount or complexity of structure and things like analysis of variance where we'd be interested in finding the minimum set of attention heads using the minimum amount of weights that maximally fits the data, and that task has some pareto frontier. But ultimately we seek to match the true underlying structure of the data in terms of multiplicity of features and dimensionality of features in the single head case. The single heads are the best predictors of the next token given they act independetly, but we can then ask what are the best single heads that produce features that are best for the second layer attention heads to predict the next token. Are those sets of heads the same as the first set of heads? How can you train those heads independently of feeding their results to the second layer of heads? Can you train the second layer of heads independently of the first layer of heads? There is research on module level training instead of end to end. Q: can you start training a model with C hidden dimension, then increase to C+1, C+2, ... in some schedule? Are there such things as continuous/fractional dimension so that you could take the derivative wrt dimension number? Ie tell me how much I gain from adding another dimension. One thing that bugs me is that all these nets are invariant to channel permutation, like we're searching over such a redundant function space! Wouldn't it be nicer to start with C=Cmin where we posit that Cmin is the smallest dimension of the single maximally informative feature; learn a net that uses this "one" (how can we enforce that?) feature, then move to C = Cmin + Cmin2 channels and freeze the first Cmin features to force it to learn the second most informative feature of minimal size Cmin2. Repeat for your resource budget to desired accuracy. Or you start the other way with C=1 and learn the best 1 dimensional feature, then add another 1, then maybe the best 2 dim feature, etc. up until you get to C=...+Cmax and we might expect there to be a few features of size close to Cmax and many features of size closer to 1 or something small; ie long tail of feature size (or really long head if we order by feature size). If we wanted to imbue each channel with some notion of identity to enforce the channel permutation invariance, maybe we have a layernorm type thing that rescales each channel i with something like Cpow(i+1, a) for some constants C and a. Ie channel 0 is defined to be the most important so we allow it to have the most scale, channel 1 second most important so it has less scale, and the distribution of scales of the parameters might be learned. Or is allowing a configurable variance the right thing here?

Q: Why is the dot product the special one? dot(u, v) = mapreduce(mul, add) but there are the other choices mapreduce(mul, mul) mapreduce(add, mul) mapreduce(add, add)

Q: Is QK positive semidefinite? Should it be? x^TAx >= 0 means we never flip the sign of any channel for all x. Though the exp in softmax turns any of those negatives into small positive anyways.

Symmetry seems to be all the rage. O(d) is the Lie group (group with infinite members) of orthogonal transformations eqv (d,d) ortho matrices (inv(A) == transp(A)) eqv symmetry of a d-circle. SO(d) (special) are the rotations ie excluding the flips. In physics U and SU are unitary for complex. Equivariant wrt a symmetry G is when f(Gx) = Gf(x) ie applying any transformation in the symmetry on the input is the same as applying it on the output. Invariant is when f(Gx) = f(x). first fundamental theorem of invariant theory: f is O(d) invariant iff f(A) = f'(gram(A)) remember gram(A) is all pairwise dot products gram (n,d) -> (n,n). f is O(d) equivariant iff f(V) = sum(gi(gram(V))V) ie a weighted sum of V, where the weights are computed from the gram matrix. E(d) is the euclidean group which preserves euclid distance, so O(d) + translations. For a point cloud, can get E(d) invariance by subtracting the mean/centroid of the points "canoniclization". Ie a way to choose a unique representative (similar to choosing the pair (u,v) st u < v or the sorted version of a set when programming.
[vid1](https://www.youtube.com/watch?v=kpbbM0WQkZ8) [paper1](https://www.arxiv.org/abs/2407.09468)

### program synthesis

todo summarize dreamcoder, latent program search

Random idea: have a seq2seq model for programs which takes input programs of length N to a fixed length kN (like compiling to simpler/micro ops). The "compiled" program tokens now become inputs of some kind to the kN layers for the execution model which takes data tokens. It would be nice if the data representation was compatible with abstract interpreation type things like ranges instead of ints. Then program search can fix the input/output and fine tune the compiled program and then decompile to get back some program. Kinda hardware reminiscent where you have a fixed pipeline depth and the compiled program maybe interpolates between some fixed function blocks or something.

Another idea after reading [this article on metric tensors](https://blog.christianperone.com/2024/11/the-geometry-of-data-part-ii/) is to embed data as vectors and programs as metric tensors, or perhaps vector fields more generally. As a metric tensor, a program should say that the distance between an input/output pair for that program should be close together. As a vector field, it would tell use the direction to travel to get from an input to its output. Initially, let's only think about the atomic operations on single values, like `toString(double(2)) == "4"`. We'd want the two statements `embed(4) - embed(2) = embed(double)(embed(2))` (I'm overloading embed for data and functions but I think its clear) and `embed("4") - embed(4) = embed(toString)(4)`. At every point in embedding space, the vector field of an operation should tell us which way to go to get to the output. We'd *also* like for that to be true on intermediate points along the path, since I don't think we'll only ever get there in one hop. This is more like diffusion I think. So maybe we always have a time parameter and integrate from 0 to 1 and that process should get us from input to output. Imagine we can train this embedding and vector fields (synthetic dataset is easy for this), we still need a few more ingredients: first is a composition of operations. We might imagine that integrate f1 from 0-1 and f2 from 1-2 should get us from `x` to `f2(f1(x))`. For a synthesis task on simple values, we then want to find a path from input to output that follows some operation's vector field in the first part and another in the second part. (I think these are the geodesic paths if the vector field is a metric tensor). I think this is like a sparse combination of all the operations' tensors. Maybe there should be a smoothing step where we lerp in time region 0.9-1.1 or something? And let's say you can find a path or many such paths, the next synthesis task is function generation, so find a sparse combination of operations that satisfies multiple input/output pairs (like `2 -> "4"` and `3 -> "6"` and `4 -> "8"`). Then, we want to do this on a stack instead of single values. For that, we want to encode some invariance like `embed(pop(push(embed(x), embed(stack)))) == embed(x)` and (struggling to come up with the right equation right now) "applying a unary op f to a stack should be the same as applying f to the top element and invariant to whatever else is on the stack". Normal programs have data constants in the program stream, but here that wouldn't make sense because data are vectors and programs are fields, so one idea when we expect there to be synthesized constants is to put them in the data stream as free variables and then find them as part of the optimization problem (and again, these are ones that have to work across all the input/output pairs so they are shared parameters). So the data going into the encoder is maybe something like `{stack: [input], constants: {c1: ..., c2: ...}}` and then we have some operation that can pull out a named constant?

Continuing above: it might be nice to incorporate types into the mix. One way would be to add a parameter `alpha` to the program fields st. `alpha=0` is for concrete values and `alpha=1` is for fully abstract values. For example `embed(double, alpha=0)(2) == 4` and `embed(double, alpha=1)(int) == int`. Not sure if the embed for data would also get this param (I think you do)? Though, if we take `alpha=1` as "the most abstract", maybe that would just correspond to a top type or something and really `alpha=0.9` would be the `int` type. The whole idea with this is we can anneal the parameter from 1 -> 0 during path finding time so that the initial path findings are over the type connectivity graph and then over the value connectivity graph (fuzzy graphs). I don't know how you would train on other values of `alpha` besides the extremes. I've wondered about this before, how do you enumerate domains for abstract interpretation which are consistent with your function. Ie, for `double`, an `alpha=0.5` would be `Even|Odd` where `double(Even) == Even, double(Odd) == Odd`. We'd also need some value (really a subspace I think) for type errors and the goal would be to get the embedded function to steer clear of these regions for well typed things and crash right into them if you try to run `double("foo")`.

Some more thoughts: still with gradients but maybe follow a conditional diffusion approach. We have an encoder conditioned on abstractness and then a score model conditioned on an operation vector and abstractness (embedding dictionary for ops, 1 per op; or maybe these come from the encoder's dictionary and then programs get encoded the same?). Goal is to have the score model point towards values in that operations range (output set) dependent on the abstractness level. Not sure how the noising fits in here, since really we want to draw samples lerped between embed(input, abstractness) and embed(output, abstractness) and have them point towards the embedded output, so maybe you just add noise on top of that and we're shaping that subspace and not just the random subspace centered on that point. Then finding a program amounts to running forward in stages with k different conditioning operation vectors on all the inputs and optimizing them to match the outputs and match the operation vectors to those in the dictionary.

Maybe instead of a scalar abstractness parameter we should use a vector since there are many useful abstract interpretations that could guide synthesis; examples: type checking, shape checking, string length, number ranges. Maybe these would come from a dictionary and the concrete interpretation would be one of them. We could then use all of the interpretations when searching for our program.

Another thing I was thinking about was that you might want an asymmetry when sampling between the input and output embed points when using noise. If you sample t=1 and then add a bunch of noise you might end up at (when projected back to the line) t=1.2 and then your vector points "backwards" towards the endpoint. Though, this is where I don't understand the rectified flow paper; it samples only on the line between start and end without noise to push it off the line, then the target vector is end - start. The direction makes sense but the magnitude doesn't change whether you're at t=0.25 or t=0.75. Still not sure why that is. Anyways, my mental picture is that you want to train the vector field such that anything in a fuzzy conical region will flow towards the output (point of cone on output, base of cone centered on input) and avoid overshooting the output because we need to link multiple ops together and want the transition to be smooth, not circling around. Maybe there is some condition around div or curl here.

I'm having a hard time thinking about the input embedding. Originally I was just thinking about embedding single values. But we do want to model binary operations, learned constants, higher order functions (maybe). So then the obvious thing is to embed an input sequence. Is it important to decode from the latent space back into a sequence? When searching for a program, we would let all input tokens be free and optimize back through the network so you don't really need a decoder. That would take care of learned constants. Every op should be its own token and then there are literals for json like things. Not sure if you need to pretrain the encoder or better to only jointly train it with the evaluator. But hmm, the problem here is that we embed the whole program into a single vector, then expect the evaluator to just crank and pop out a value. Whereas before we conditioned the evaluator on each operation we wanted it to do. We could still have a data/code split where the stack is encoded as a sequence and the op conditions the evaluator and the target state is the next stack state. There's really no point in feeding the whole sequence of a program in because the only op that matters is the currently executing one (excluding loops and conditionals I guess). For conditionals, maybe instead of conditioning on 1 vector, we condition on 3, where the first determines if we are executing a conditional or not; if we are, then vectors 2 & 3 are the then and else, otherwise we just pass the op as the second vector and that's it. Thinking about transformers, the interesting thing there is that the sequence of vectors are transformed to the target vectors in a coupled way.

Thinking more about transformers, it might be useful to have some unconditioned layers that encode into a latent space, then some conditioned layers by the op we want, then some unconditioned layers to decode. One thing the encoding layers might do to prepare for the op is to create the superposition between each possible combination of args; if we only have up to 3-arity functions, then it can create the sum of vectors for every possibility (but note that instead of just simple sum, attention may combine them with more complexity). Then when we execute the op, it has to learn the mapping from those vector combinations to outputs, along with a fixed attention on which combination of arguments to process. Maybe those combinations of arguments should get baked in and always appear in specific token positions. In program synthesis more generally, it is a very important step to pick which values we want to combine (even if we don't know what to combine them with yet), so maybe it is worth having a dedicated circuit for this.

One thing that seems well suited to attention is the constants problem. Imagine we have the setup where we have `1 2 3 ; 1 1` where `1 2 3` are constants and `1 1` are the values on the stack. We then have operations `c0` `c1` `c2` which push the `i`th constant on the stack. Some training examples are then

```
1 2 3 ; 1 1 =[c0]=> 1 1 1
1 2 3 ; 1 1 =[c1]=> 1 1 2
1 2 3 ; 1 1 =[c2]=> 1 1 3
1 2 4 ; 1 1 =[c2]=> 1 1 4
```

where the `[op]` is the conditioning op vector that we apply to the encoded constant + stack data, and we want the transformer to learn only the new stack data. The last two examples are both conditioned on c2, but have different mappings `1 1 => 1 1 3` and `1 1 => 1 1 4` because the constants are different. These are really begging for some symmetry because the "rule" for c2 is

```
_ _ y ; ... =[c2]=> ... y
```

And any of the other ops are invariant too where

```
c... ; ... x y =[op]=> ... z # where z = x op y
```

ie a binary op on x y doesn't care about the constants or the other things on the stack and only has to copy them over. We could of course generate huge number of augmented training examples to learn this, but maybe we could bake it in too.

Another approach to the abstractness conditioning parameter thing from above would be to instead augment the examples with a postfix of "shape" and "type"; ie we search for a sequence of ops O s.t `x O == y && x O type == t && x O shape == s` where we substitute t and s appropriately (assuming we know the desired output type and shape). I think these could anchor the search better because we increase the number of known targets (though they are redundant in a sense, ideally could get more uncorrelated anchors).

Another random thought is that when we are searching over programs as a sequence of ops, they won't exactly match our dictionary of ops and so we really get a distribution over ops. We can of course sample the top k or just randomly sample from here and that is fine, but it would be nice to give a more grounded evaluation of this fuzzy program. One possible way to do this is to compute an expectation on the true computed outputs for sampled programs. Ie `p_i * encode(eval(P_i))` where `p_i` is the probability for the sampled program `P_i`. This uses the true computed value of `P_i`, encodes it to a vector, and (weighted) averages it with the other samples. Though I suppose if we're encoding with a multi-vector approach, not sure what the right way to average these is. When the fuzzy program is exactly (one of) the true program(s), then this expectation will match our target value.

The above is about giving a concrete value to a fuzzy program by taking the expectation over programs drawn from that fuzzy program and evaluated on some inputs. It would also be nice to give a similar concrete evaluation for some concrete operation on a fuzzy value. Right now I haven't been thinking about a decoder for embedded values/stacks, so we can't just sample concrete values from the fuzzy value and evaluate them and take the expectation. So maybe you do something like nearest neighbor to known concrete values and take the weighted average of the neighbor's evaluations. But that is kinda meh. Maybe a decoder is necessary/good.

One more piece that might be really useful here is a (okay I think this one is actually more like a metric tensor) a bilinear model which takes two embedded values and tells us how close one is to the other. Maybe it is multidimensional output where the 0 vector means identical.  And we hope to learn this model such that it we can use it to give feedback on partial solutions that tell us if we're on the right track. The evaluation model tells us how to move from input to output. The measurement models tells us how "similar" a certain output is from a target. The prior going in is that "similar" would ideally capture many notions of similar like hamming distance, exact match but shifted by N digits/cells, partial match but rotated 90deg, etc. We do this in vector space because the discrete similarity measures are too discontinuous and we'd have to pick particular ones, better if we could be lazy and learn them. Now how to train this?

From looking at arc examples is that when presented with the input/output pairs `i -> o`, it is useful to actually first find some data and program that goes from `j -> i` (and possibly the inverse `i -> j`), then do a search on `j -> o`. A silly example might be if finding `sqrt cube` and given `25 -> 125`, `9 -> 27`, then the model first notices `5 -squared-> 25` and `3 -squared-> 9`, then `5 -> 125` and `3 -> 27` is a bit more "obvious".

Another tactic that might fit somewhere here is properties. If we learn a set of functions with boolean or integer outputs, then it might condition the search to know that eg the input examples are rotationally symmetric (arc again) or something like that. Not sure how these fit because I don't think they're actually going to be on the solution path.

In thinking about how to train the model, it would be nice to do it in more of a reinforcement cycle style than as a bulk synthetic dataset way. For the latter you would either randomly generate or somehow compile a list of programs (initial stack states and list of ops), then you can train on every intermediate state of all of those executions. For the former, you would almost start empty and have some process that produces programs (single or multiple ops) that it "wants" to learn on because it is somehow "interested" in or has bad loss or underexplored. And additionally at test time, I would hope this process would continue as we can't really expect the model to be pretrained on every computable state, so we should expect to finetune by expanding or improving the model on the relevant computational states it needs to pathfind in. That could be actual finetuning where we are updating the base model weights with more concrete evaluations about the things it has requested or something else ... . For how to have the model ask for things it wants computed, I'm not sure. It goes back to the above about whether we can take an embedded value and decode concrete values that we can then compute on. If we can, then one way is (our setup is that we are optimizing a sequence of embedded states and ops where state0 is the input and stateN is the output and our loss is something like `sum_norms(state_i - op_i(state_{i-1}))`) to sample concrete states at `state_i` and compute sampled ops from `op_i` and update the model with this information (the expectation of these values).

Now I think a stack model is bad and better to do a register machine. Mainly got there by thinking about all the dup/over stuff you need for most things, and that having the model learn dup is such a waste; maybe you could add a stack manipulator as a condition to each op so that in effect you learn fused `dup +` instead of `dup` then `+`, but still you're going to duplicate things and if eg your arc board is the base of the stack, then duping it anywhere (if you can't fuse it in one step) is going to blow up your sequence length. So anyways on with thinking about a register machine.

For a register machine, your machine state is R registers where each register holds a fixed number N tokens with dim C; so (N,C). Values of variable length get encoded to N tokens through some encoder. We learn some operator network which operates on (simplify with just binary for now) 2 registers. To apply our operator network to a machine state, it uses two attention vectors (of size R) to take a weighted sum of the registers so we end up with an input of `(2, N, C)` and O operation tokens (from an embedding matrix) and should compute N output tokens that correspond to the encoding of the concrete result of applying that operation. The input is probably the tokens concatted so (2N + O, C). We can compute a program output from an initial machine state and a program of length P where we have `(P, 2, R)` attention "register-selectors" and `(P)` operations (if we're optimizing, I guess `(P, O)` for O operators and we softmax each row and these are "op-selectors") by iterating over each op in the program and concat'ing the results of the network together. The register-selectors have to be masked to be causal so that you can only use a register as input that has already been computed. This is a bit lame b/c we have to do P passes through the network to compute the final output state, so one modification would be to have stages of some width W (could be variable) and then we get parallelism within the stage (trading breadth for depth), example:

```
# each select has an implicit selection vector of appropriate size (op vs reg) and mask that gets softmax'd
# serial
a = ...  # some input and/or maybe some constant
b = ...
c = select(ops)(select([a, b]), select([a, b]))
d = select(ops)(select([a, b, c]), select([a, b, c]))
e = select(ops)(select([a, b, c, d]), select([a, b, c, d]))
output = e

# stages of width 2
a = ...
b = ...
c = select(ops)(select([a, b]), select([a, b]))
d = select(ops)(select([a, b]), select([a, b]))
e = select(ops)(select([a, b, c, d]), select([a, b, c, d]))
f = select(ops)(select([a, b, c, d]), select([a, b, c, d]))
# and maybe one stage of width 4
g = select(ops)(select([a, b, c, d, e, f]), select([a, b, c, d, e, f]))
h = select(ops)(select([a, b, c, d, e, f]), select([a, b, c, d, e, f]))
i = select(ops)(select([a, b, c, d, e, f]), select([a, b, c, d, e, f]))
j = select(ops)(select([a, b, c, d, e, f]), select([a, b, c, d, e, f]))
output = j
```

again, we hold the program P fixed between input/output in the task and we optimize for the loss between the final program output (last register of N tokens) to match the encoder's output of the example outputs. We maybe also want to minimize the L1 of the op-selectors so that in the end they are just picking a single operation. Kinda reminds me of [Deep Differentiable Logic Gate Networks](https://arxiv.org/abs/2210.08277). In eg arc-dsl, there are higher order functions where not every application is of the form `op(reg, reg)` but also `op(op, op)`, `op(op, reg)`, `op(op, op, reg)`, how could we support that? compose is probably the least important one since that can already be expressed as two sequential operations (though if you want continual learning ideally you could learn these sequences as reusable functions and update your list of ops). Same for fork. Idk yet. Another one is indexing; if you're dealing with boards then you'll need ternary ops for `a[i:j]`.

To support multi-arity, I guess I see two directions, one is what I say above about having a fixed register 0 with an `empty` value and an operation can always pick it, but then you'd want to enforce that the empty value is at the end like `f(a, b, empty)` and not `f(a, empty, b)` which seems tricky. And you would have every op have k register-selectors for the max arity k. Another would be to go more like a fixed function piece of hardware and say that at every stage, there are for example 4 1-ops, 4 2-ops, 2 3-ops, and 1 4-op and if you need more 4-ops for example, you just need more stages and fill the unused ops with nops. This raises a question on whether you would then share the same operator network between all the arities either with padding tokens or attention masks, or have separate network per arity. This looks like

```
# 2 1-ops, 2 2-ops, 1 3-op all in one stage (only a,b available)
a = ...
b = ...
c = select(ops1)(select([a, b]))
d = select(ops1)(select([a, b]))
e = select(ops2)(select([a, b]), select([a, b]))
f = select(ops2)(select([a, b]), select([a, b]))
g = select(ops3)(select([a, b]), select([a, b]), select([a, b]))
...
```

One thing to think about is when optimizing/finding, if we only ever compare the final register to our target, that might be overly restrictive. We could instead compare it to every register and use that as a signal we are on the right track. And if it is in the same register across all cases, then we should take that as a signal we can just return that register. So maybe there is a final register return selector that we use and instead of matching against the last register, we match against softmax(return) @ registers.

For the learned operator network, perhaps we treat it as k1 tokens for the value and k2 tokens for the type and shape. If we fix at shape 3 arrays, then we might have k2=4 with `<type, shape2, shape1, shape0>` so that `1+1 -> <int8, 1, 1, 1>` and `[1, 2] + 1 -> <int8, 1, 1, 2>` or something like that. Not sure if that is just redundant with giving it k1 + k2 tokens for the type&value even if not explicitly separated like that.

Lately I've been thinking about what it might look like to not use a net at all. We still have our selection vectors that we project then softmax to get a prob dist over registers and operations. We could use full dimension vectors so that we don't do a projection step, but a) this gives us way more params to optimize over and b) I am curious about the effect of changing one parameter in the selection vector affecting the prob of multiple registers/operations at once. Without learning a representation for the unembedding matrix, maybe we just fix it at random vectors. Then once we have our probability distributions, we can sample programs, evaluate them, and get a set of outputs. And actually I think it is more useful to capture the set of outputs of every register because we'd like to get a partial signal if the early part of the program looks good (or happens to be short depth program) and the second half just happens to be bad. So then we need a similarity metric between values of arbitrary type. One interesting bytewise metric is the LZJD (Lempel-Ziv Jaccard Distance) where you collect the LZ substrings of bytes, hash them, and take the k smallest hashes; the JD is then over these sets of numbers (ratio of intersection size to union size). Could also ditch the hashes. This sounds nice, though is going to be very low precision for short byte strings like if the target output is u32:42. I do think you'd want to prefix with the type so that u32:0 is closer than string:hello and perhaps using decimal digits is useful so that u32:4 is closer than u32:7777777. So whatever metric you choose, you then compare the distance of every register of every sampled program to the target output and we get a set of scores. We can collapse this score into a single number with maybe a sum or sum-of-log. And we would want some either additional boost to the program which selects the right register, or now that I say that, we could do a weighted sum of scores of each register based on the output register selector. Maybe that is a second term and we can weight them differently over time.

So we can assign a score to a point in the latent space (pre-projection and softmax), but we don't have a gradient so we'd have to do some gradient free optimization or approximate the gradient, though I don't think it is smooth at all so approximating isn't that appealing. If we approximate, I think the idea is to, for every parameter one at a time, increase it by epsilon and check the score. One detail here is whether we use the same random seed to sample the programs or not. If we do, then we know that we have an identical program up to that point and can reuse all the values (assuming we've saved them). Additionally, if our epsilon change doesn't result in a different random choice (per sample), then the whole program will be the same and we can reuse. Not using the same random seed seems weird because then we can't be sure whether the change in parameter changed the score or whether the seed changed the score (and really not whether, but how much blame we can put on each factor).

Maybe there is a pseudo backprop possible here where we first score every register (or just the last/output register), and then working backwards, distribute some extra score to the ops that produced this register's inputs. An example is probably easier:

```
...
c = select(ops1)(select([a, b]))
d = select(ops1)(select([a, b]))
f = select(ops2)(select([c, d]), select([c, d]))
# one sampled program is
c = ops1.f(a)
d = ops1.g(b)
f = ops2.h(c, d)
# f gets some decent score matching our output
# what went into producing f?
#   - f: select(ops2)
#   - f: select([c, d]) left
#   - f: select([c, d]) right
#   - c: select(ops1)
#   - c: select([a, b])
#   - d: select(ops1)
#   - d: select([a, b])
#   - and so on up the chain
```

and what we are really doing is giving a score to the one-hot distribution of the sampled program's selector vectors. Unlike gradient backprop where we end up with the gradient, this backprop just moves scores backwards, maybe with some falloff. To get an update to the selectors, we can take a score weighted average of the embedding vectors. One thing to note is that this assigns the same score to the operation selection and the register selection; it cannot distinguish between whether we did good because we chose the right operation or whether we chose the right register; I'm not sure it is meaningful to reward one over the other?

I am trying to understand if Bayesian optimization would work for this as the pseudo gradient thing seems sketchy. One thing I releaized about the return selector is that a single sampled concrete program should have a single return register (and not the weighted average thing I mention above) because the average of the prob program is over the sampled concrete programs. This also means when we sample a return register, we can run the program for only that many steps and early return.

Another thing I realized when thinking about the whole "but this only learns straight line programs and will never build abstractions" (note that we can have a ite if-then-else for branches, but still no loops right now (though we do have some broadcasting)). And yes, building up functions would be very nice. And I think you can do this. These functions would also be probabilistic programs and let's say you get 256 functions for each arity 1,2,3. Define one of the builtin ops as "call function" and it would take a function id/index and would have a selector over the 256 functions. These functions would also be defined as a fixed op length with return selector and maybe you have a range of fixed length sizes so a few functions can be large but others would be smaller. Function calling works as normal, copy in the args, run, return the value. Whereas before I was envisioning optimizing/finding a single program for multiple input/output pairs, with functions I actually think you want to optimize/find N programs with their input/output pairs that all share the same searchable/optimizable functions, under the assumption that the N programs you're searching for have some common theme/structure (like ARC) where you expect them to reuse subtasks (functions) across the tasks. You then optimize by running each program on each input/output pair trying to match all pairs, and optimize the N programs AND the 256x3 functions all together. I think this seems nice because I would hope this lets easier tasks get solved first which might aid in the harder tasks that could then reuse some of the functions. And maybe you really push the programs to be short so that most of the smarts goes into the functions. How many parameters is this? Let's say you have 100 tasks and programs of length 20, and functions of average length 20, then you have 256x3x20x256 op selectors in functions and 100x20x256 op selectors in programs, and 256x3x(20x21)/2 register selectors in functions and 100x(20x21)/2  reg selectors in programs = 46.2M parameters. Idk maybe that is too many, but can easily dial back the number of ops and/or functions to shrink those selectors. (uh oh seeing things that say beyond 20 dims bayesopt is hard).

### diffusion and score-based generative models

From [this amazing video](https://www.youtube.com/watch?v=wMmqCMwuM2Q)

note to self using grad everywhere but remember grad(f : n -> 1) : (1,n) vector of derivatives and jacobian(f : n -> m) : (m,n) matrix of derivatives

* we have data samples, like images, that we suppose come from some underlying distribution. these samples are very sparse in the full space, ie the density is very low/spread out among all possible images
* to model the data, we can use a nnet f to predict p(x) but nnet hard to restrict to a pdf. we can always use exp(f(x)) to get nonnegative, but we need to divide by a normalizing term Z to get a true pdf. softmax takes care of this in the discrete case, but is intractable here. Z is computable in closed form for eg gaussian. alternatives to exact normalizing constant are:
  * approximate the constant (energy based models)
  * restricted nnets (autoregreesive, normalizing flow, variational ae)
  * model the generation process only (GAN)
* for a pdf p(x), the (Stein) score function is grad(log(p(x)), x) (score is a crazy name to me). gradient of the log prob
  * for p(x) = exp(f(x)) / Z, score(p) = grad(log(p)) = grad(f(x)) - grad(log(Z)) and the second term goes to 0
  * so s(x) = grad(f(x)) which we can get with backprop for any nnet f
* to estimate score from data, need an objective, for score(x) : d -> d
  * replace fisher divergence with score matching because it requires knowing the true score function. but score matching requires trace of jacobian, so 1 backpass per dimension of the input
  * sliced score matching (from sliced fisher div) projects the score (vector field) to random directions. end up with vT grad f(x) v = vT grad vT f(x). ie we dot with a direction vector v on the output of the nnet so we get a scalar output and then again after the backward pass to get a scalar result (on both sides). so then we only need one backprop per sample+direction
  * denoising score matching, derive a noisy distribution q from p by adding gaussian noise and then try to find the score of this dist
  * understand the losses a bit better now, for a while it made no sense you could evaluate the loss without knowing the true score at that data point; one high level note is that at a data point, the grad should be zero b/c the prob is at a local maximum; for a noisy point, we want the grad to point towards the data point, so the grad should be -noise at x + noise
* sampling, assume we've learned a good score function s
  * if we directly follow s by integrating random points, we'll get clusters boo. so we use langevin dynamics to add noise at each step during integration
  * on its own, this gives bad samples b/c our learned score function is very innacurate in low data-density regions (remember real images are very sparse in the space of all images)
  * by adding noise to data points, we can learn a better s in regions around our data points
  * extend by doing this for multiple noise levels to get one s for each noise level
  * extend by doing noise conditional score model where the score model gets the noise level as an input s(x, std) (related to DDPM todo)
* control the generation process
  * to condition on some input (like a prompt/caption), we want to train a `p(x | y)`. expand with bayes rule and compute the score function and we get `score(p(x | y)) = score(p(x)) + score(p(y | x))`
  * `p(y | x)` is just a model that takes an image and gives a caption (or whatever we are conditioning on). Can use any model we want in conjunction with our score(p(x))
  * though really we need a `p(y | x, t)` a time dependent classifier (can train a classifier on noised images)
* probability evaluation
  * train a model to estimate based on varying noise level t [0, T] score(pt(x)) where p0(x) are our data points, pT(x) is a fully noised version and is eqv to eg a gaussian and pt(x) is somewhere in between.
  * sde stochastic differential equation dx = f(x, t)dt + g(t)dw where g(t)dw is the stochastic part
  * for this we choose sde of the form dx = sigma(t)dw, and can derive a reverse time sde which depends on a time dependent/condition score function s(x, t)
  * can derive an ordinary differential equation ode (probability flow ODE) which is a function of s(x, t)
  * lets us compute p(x) for any image using an odesolver to step s(x, t)
* Q&A says that unet is a common architecture for the actual nnet
* some more practical investigations in [this video](https://www.youtube.com/watch?v=T0Qxzf0eaio)
  * stochastic still gives best generation results
  * most training time spent in the middle third of t
  * the nnet needs scaling so that across all noise levels the magnitude of values are similar
  * they use a weighted skip connection so that at low noise levels, they effectively predict noise to correct input, at high noise levels, predict signal to override input
  * the skip connection effectively makes it predict the noise b/c its like img = noisy(img) - noiseof(noisy(img))


### structured state spaces

From [this video](https://www.youtube.com/watch?v=luCBXCErkCs) I preferred it to the other mlsys presentation

* considering signals, a sampled version of some underlying continuous process
* trying to approximate a 1d signal over time u
  * to do that we want to derive some state x from u that we update over time
  * example is exp moving avg EMA where x = lerp(x, u, alpha) which has infinite context length (summarizes entire context) and is updateable in constant time
  * HiPPO (high order polynomial projection operator) extends this idea to deriving a vector x of desired size which are coeffs to a polynomial basis and can be efficiently updated
  * depends on a measure which defines the weighting of the past signal for how much we care about it
  * state update is an ode (hippo operator) x'(t) = Ax(t) + Bu(t) where A (hippo matrix) is the state transition and B tells us how to mix in the signal
  * you can then plugin the state at x(t) into the poly basis to reconstruct the signal. loss is the squared error (I think?) weighted by the measure
  * "all hippo operators have displacement rank <= 3 so ahve linear-time matrix-vector multiplication" todo what is displacement rank
* if we use hippo in a layer/model, we are increasing dimensionality from 1 -> d (where d is the degree of poly basis)
  * so instead we output a 1d y = Cx + Du where we have (1,d)(d,1) + (1)(1) so dot the state with a vector and add a scalar multiple of the input (skip connection)
* the x' = Ax + Bu and y = Cx + Du is an SSM (in most general form, ABCD can be time dependent)
  * output y(t+1) can be computed online, but when we're training and we know the whole sequence, would like to avoid
  * whole output y(t) can be computed convolutionally y = conv(u, K) skipping the computation of the state signal x(t) (though computing K is still slow)
    * K(i) = C matpow(A,i) B for i in L so yeah computing K naively is real slow
  * we then discretize ABCD for some step size
* structured state space model gives structure to the ABCD which lets us compute K efficiently
* on continuous signals, s4 has good zero-shot perf on resampled signals which tanks discrete methods (though is that passing in the step size into the discretization method?)
* [https://srush.github.io/annotated-s4/](https://srush.github.io/annotated-s4/)
  * A is the hippo matrix, B C step-size and scalar D are learned
  * stack one SSM per input dimension to get a layer from C -> C

### questions (and some answers)

* Q: In mha, the two equivalent views of O are that we concat the result of each head (T,h) to (T,C) then multiply by the (C,C) O matrix. The other is that we multiply each (T,h) head result by a (h,C) slice (horizontal/row slice) of O and then sum the results. Why is O even there? The paper says to give us proper dimensions but surely without it concat'ing gets us back to dim C anyways?
  * A: channel mixing; if we just concat the results, the first h channels are just the result from head 1, the next h from head 2 etc. The equivalent view of just concat'ing is to multiply by the (h,C) slice of the identity matrix and summing which is the same as concat'ing. And then when O is not the identity matrix, it can spread a mixture of the input channels to the output channels

```
h=3 C=6
r1 = [a b c]
r2 = [d e f]
concat(r1, r2) = [a b c d e f]

          [[1 0 0 0 0 0]
[a b c]  @ [0 1 0 0 0 0]
           [0 0 1 0 0 0]
------------------------------- +
          [[0 0 0 1 0 0]
[d e f]  @ [0 0 0 0 1 0]
           [0 0 0 0 0 1]]
=>

[a b c 0 0 0]
------------------------------- +
[0 0 0 d e f]

=>

[a b c d e f]
```

* Q: In mha, our output for each token is always in the span of O, isn't that limiting?? Normally this then goes into a ffn but it just seems weird that no matter what complicated thing that attention does, we always "just" get a result in the span of O
  * kinda true for all matrix based NN, but is a small wtf moment
  * so with the "residual stream" ie x + f(x), even if the f is a ffn and the output of f lies in the span of the second matrix, the sum x + f(x) isn't constrained in that way
* Q: Imagine the trivial 0-layer transformer where we only embed then immediately unembed: UE, the prediction for each token will be nearly one-hot after softmax with random initialization (assuming weight tying) but not perfectly because we have V >> C. Training this model will try to approximate the bigram statistics (circuits paper) since we can only predict: given this token, what is the probability vector for the next token. Update: this bigram statistic assumes weight tying isn't being used, b/c then the perfect unembedding matrix will map each embed token to the closest vector that approximates the bigram statistics after softmax. I guess this makes sense and kinda already answers the question I wanted to write down (since initially I was thinking that the 0-layer transformer would predict the input token, but that isn't true, especially after training) but the nagging thought is something like: why doesn't the model have two vectors per token, one for the data and one for the prediction. Transformer combines those into a single vector right now. I guess I'm thinking something like: the prediction vector should be initialized to the uniform distribution (though as a vector that then gets unumebedded and softmax, we aren't guaranteed to have an x such that softmax(Ux) = [1/V 1/V ... 1/V] and even if you do it will change every opt step if you're updating E/U) as the uninformed prior, or perhaps as the bigram statistic vector as a slightly less naive prior (which again I'm now understanding is what it is already doing)

# Links

* [Attention Is All You Need](https://arxiv.org/abs/1706.03762)
  * self/cross attention, transformer
* [Deep Residual Learning for Image Recognition](https://arxiv.org/abs/1512.03385)
  * resnet, residual, skip/shortcut connection
  * x + f0(x) + f1(x + f0(x)) + ...
* [A Mathematical Framework for Transformer Circuits](https://transformer-circuits.pub/2021/framework/index.html)
  * residual stream, QK/OV circuit
  * multi head attention can either be seen as the O times the concat of attention on a chunk of channels, or as a sum of heads each with their slice of O to upscale back to C [link](https://transformer-circuits.pub/2021/framework/index.html#architecture-attn-independent)
* [Understanding and Improving Transformer From a Multi-Particle Dynamic System Point of View](https://arxiv.org/abs/1906.02762)
  * numerical integrator, Lie-Trotter splitting scheme and the Euler's method, Strang-Marchuk splitting scheme
  * attention is like diffusion (interaction) and FF like convection (indepenent particle flow)
  * Macaron layer reorders so we do 1/2FF then Attn then 1/2FF
* [Improving Transformer Models by Reordering their Sublayers](https://arxiv.org/abs/1911.03864)
  * related to above where they test loads of variants of (s|f)* layers (s for self attention). No scaling on f layers
* [Residual Networks Behave Like Ensembles of Relatively Shallow Networks](https://arxiv.org/abs/1605.06431)
  * unroll a deep residual network to view as a sum of paths, like in the circuits paper
  * for `-f-g-` you get paths `-----` `-f---` `---g-` `-f-g-`
* [Improving neural networks by preventing co-adaptation of feature detectors](https://arxiv.org/abs/1207.0580)
  * dropout
  * randomly zero out parameters during training, average outputs at test time. Summing log-probs is same as geometric mean of "experts"
  * but then they also do a weird renormalization of weights (or is it inputs, I'm confused) if they exceed an L2 constraint. and a weird initialization
  * the paper uses p for probability of element to be 1, and pytorch uses p for probability of element to be 0, so paper multiplies by 1/p in the forward pass and torch does 1/(1-p)
* [Layer Normalization](https://arxiv.org/abs/1607.06450)
  * confusing b/c they present it as though its norming a layer's weights (like weight normalization, where w: vector = vg/norm(v) and v and g are learned), but in torch it just acts on the data passing through. I find the neuron focus confusing
  * interesting they motivate it as a way to speed up learning
  * as a post layer norm, like layernorm(mlp(x)), it makes the output invariant to scaling of the mlp's matrix
  * as a pre layer norm like mlp(layernorm(x)) I think it makes the output invariant to scaling of the data
  * post layer norm was the original architecture in transformer, but pre layer norm is the gpt2+ standard
  * table 1 gives more invariance properties
  * pre layer norm seems to make sense b/c (I think) your layers experience less covariate shift (from shimodaira 2000 via batch norm), as your layers learn, you don't want a doubly constantly moving target, obv there will be refinement in the residual stream representation, but don't make it harder than it needs to be with shifts or scaling to worry about too
  * out = (x - mean(x) / sqrt(var(x) + eps)) * w + b where w and b are learned. applied to each input independently (or configurable by shape)
* [Understanding and Improving Layer Normalization](https://arxiv.org/abs/1911.07013)
  * adanorm: y = f(centerscale(x)) * x where centerscale(x) = (x - mean(x))/std(x) and f(x) is uniquely C(1-kx) by their requirements for constants C and k
  * derivatives of mean and variance ie backward more important than forward normalization
  * w and b parameters of layernorm can lead to overfitting
  * 2.1 eqn 1 defines h as dot(g, N(x)) + b but that has to be a typo right? must mean hadamard (entrywise product)
* [Seeing is Believing: Brain-Inspired Modular Training for Mechanistic Interpretability](https://arxiv.org/abs/2305.08746)
  * regularize overall layer weights by `d_ijk|w_ijk|` (locality; 2d euclidean distance between neuron (rows) after laying out layer neurons (matrix)) and occasionally trying row swapping within a layer if it minimizes this loss too since they say it gd gets stuck in a local minima
  * pretty pictures
  * the mnist pictures show the last layer of digit "neurons" (I suppose its a fine term when visualizing rows as dots but I still have an aversion to it) with one dot per digit arranged in a circle; did they use a circular layout in the distance calculation? I guess it is because the location of some digits change (see last page). But idk if that is a useful layer to have positions on; I guess if the data were skewed so all 9's were in the top right and all 1's were in the bottom left, then maybe. The dots layout is still confusing me a bit b/c for example the input layer is a 2d grid of dots where each dot is a scalar, but then the actual layers are one dot per row/matrix (for 2d/3d) right?
* [Language Modeling with Gated Convolutional Networks](https://arxiv.org/abs/1612.08083)
  * gated linear unit, GLU
  * glu = mul(relu(Wx), Vx),  bilinear = mul(Wx, Vx), lstm style (gated tanh unit) gtu = mul(tanh(Wx), relu(Vx)) leads to vanishing gradients b/c you get tanh' and sigma' on both (respective) factors of chain rule
  * they call this is a multiplicative skip connection for the gradient. todo understand the gradient calculation better since it seems they ditch the
  * why does google rank the "glu variants improve transformer" paper over this one
  * fig 1 diagram shows taking half the vector for W and the other half for V, like glu = mul(relu(W@left(x)), W@right(x)), reminds me of affine coupling layer (flow matching)
* [NICE: Non-linear Independent Components Estimation](https://arxiv.org/abs/1410.8516v6)
  * affine coupling layer, u, v = split(x); y = concat(u, mul(v, f(v)) + g(v))
  * didn't read much, came via [vid](https://youtu.be/DDq_pIfHqLs?t=267)
* [HiPPO: Recurrent Memory with Optimal Polynomial Projections](https://arxiv.org/abs/2008.07669)
  * todo
* [https://github.com/lucidrains/x-transformers](https://github.com/lucidrains/x-transformers)
* [https://github.com/karpathy/minGPT/blob/master/mingpt/model.py](https://github.com/karpathy/minGPT/blob/master/mingpt/model.py)
* [How do we build general intelligence](https://www.youtube.com/watch?v=HEp4TOrkwV4)
  * specifically [Large Language Models Are Zero-Shot Time Series Forecasters](https://arxiv.org/abs/2310.07820)
  * got me thinking about how you could build a composable model of dictionary + sequence model where they don't know anything about the other. The dictionary is provided zero-shot
  * also about whether you could have a human-like dictionary that referenced a sequence of other dictionary words
* [Diffusion Models: A Comprehensive Survey of Methods and Applications](https://arxiv.org/abs/2209.00796)
* [GLU Variants Improve Transformer](https://arxiv.org/pdf/2002.05202v1)
  * GELU (gaussian error linear unit) is the gaussian activation function, looks like ReLU with a little smooth elbow near the origin
  * GLU (gated linear unit): "component-wise product of two linear transformations of the input, one of which is sigmoid-activated"
    * glu = mul(activation(Wx), Vx)
    * compare to mlp = relu(Wx)V
* [Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation](https://arxiv.org/abs/2108.12409)
  * ALiBi (Attention with Linear Biases) is a type of positional encoding
  * instead of adding positional information to the tokens, bias the attention matrix (result of QK; what weights the V) with a function of i,j
  * easy to implement and easy to extend for longer sequences than you train on
  * lower diag matrix M(i, j) = j - i
  * each head may use a different scalar of this matrix (to modulate how much the head "cares about locality")
    * they don't learn this, but is static, and given by (exp is base 2) exp(-(arange(8) + 1)) (ie 1/2, 1/4, 1/8) for 8 heads
    * for other heads they scale between them like exp(-((arange(nhead) + 1) / (nhead/8))) (ie powers go like 0.5, 1, 1.5 ... for n=16)
  * I like adding a static slope per head because it breaks the symmetry of heads in an imposed way
* [ModernBERT](https://arxiv.org/pdf/2412.13663)
  * no bias except in final decoder, pre-norm (for tokens) and layer norm (for weights), rope embedding, geglu instead of mlp
  * alternating attention: every third layer does global attention, rest do local attention (each token attends to +-64 tokens)
    * local attention supported directly by flash attention `window_size`
  * unpadding: instead of having each separate sequence be an element of the batch which requires padding to the length of the longest in the batch, concat into one single sequence and use attention masking to keep sequences separate
    * supported directly by flash attention (`flash_attn_varlen`) by passing `cu_seqlens` cumulative sequence lengths
      * ie for seqs of length 2, 3, 4, `cu_seqlens` is 0, 2, 5, 9
    * because there is still a max sequence length limit of the concat'd inputs, use sequence packing to arrange the inputs into low-total-length-variance mini batches
  * as in original BERT, when using as a fixed length embedding (for indexing/retreival), just takes the first token
    * can also use multiple tokens for multi vector retreival
  * they say they use varlen attention & rope from flash attention, but I don't think there is varlen with rotary in fa. there is with alibi which is cool
* [Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538) (MoE)
  * want more parameters, but without blowing up compute; so a single evaluation should use some subset of the total parameters
  * softplus is a smoothed relu (always positive unlike gelu)
  * similar to a glu, mul(gate(x), expert(x))
    * in simplest form, gate is softmax(WG x)
    * next is softmax(topk(WG x))  though I was thinking it was topk(softmax(WG x)) though I guess that doesn't sum to 1
    * finally add some noise gated by a learnable noise matrix softmax(topk((WG x) + mul(noise, WN x)))
      * helps with load balancing... didn't read too much
  * by using topk, the experts with 0 weight don't need to be computed at all
  * within a batch, not very efficient if you spread each input to unique experts because then your expert only has batchsize 1
    * so do some aggregation
    * but don't exceed an expert's batch size either
  * the expert could be any network, but they study FFN
* [Linformer: Self-Attention with Linear Complexity](https://arxiv.org/abs/2006.04768)
  * [Johnson–Lindenstrauss (JL) lemma](https://en.wikipedia.org/wiki/Johnson%E2%80%93Lindenstrauss_lemma): "a set of points in a high-dimensional space can be embedded into a space of much lower dimension in such a way that distances between the points are nearly preserved"
  * they use JL to say that instead of computing full attention matrix (QK^T) of (T,T), we can project our sequence from (T,C) to (k,C) keys (NOTE this is reducing the number of tokens and mixing their channels) and likewise (k,C) values and do cross attention (note I think of anything that isn't attention(X) = softmax(QX @@ KX) @ VX as cross attention but maybe that isn't totally accurate (sidenote I kinda like @@ as being outer)). between our original sequence and the down projected shorter sequence
    * lowers attention matrix from (T,T) to (T,k)
  * linformer(X) = softmax(QX @@ EKX) @ FVX
    * E = dR, F = exp(-d)R for small contant d and are fixed; R is Normal(0, 1/k); shape is (k, C)
    * these random projection matrices are (or in expectation?) satisfy JL
  * they observe best performance when sharing E = F across all heads and layers??
* [TokenFormer: Rethinking Transformer Scaling with Tokenized Model Parameters](https://arxiv.org/pdf/2410.23168)
  * wouldn't it be nice to be able to add parameters without retraining (continual learning)
  * "pattention": do "cross attention" between input tokens and static keys and values
  * then use pattention in self-attention to compute QKV instead of simple (C,C) matrices
    * and the output, and as the feed forward layer??
    * that is the tokenformer
  * from [yannic](https://www.youtube.com/watch?v=gfU5y7qCxF0) and [gabriel](https://www.youtube.com/watch?v=4lGgbkD6Z0I) videos, they point out that pattention is really just an MLP variant (and discussion in the comments, particularly the second video)
    * this is actually super interesting to me, basically they fit this formula like f(q(x) @@ k(x)) @ v(x) where f is a nonlinearity (usually either scalar-wise like relu or row-wise like softmax)
      * remember: the number of output tokens comes from the rows of the queries, either X or QX; the number of keys and values have to match each other, but can be different than T (and is one of the things I think of as cross attention). This gives you a rectangular attention matrix that takes the weighted row-wise-sum of the rectangular value matrix. The values can be of different dimension to the input but are scaled back up/down
      * mlp: k and v are constant (discard x) and f is relu or silu or gelu but could be softmax and then you get attention
        * relu(X @@ K) @ V
        * relu((T,C) (C, 4C)) (4C, C) -> (T, C)
        * one difference to note is that k and v in MLP are typically an up-down-projection into C -> 4C -> C while mha is a down projection C -> H -> C
      * so an equivalent way to think about an mlp is like doing attention between your T input tokens with 4T keys and 4T values that are just learnable params and use relu instead of softmax or whatever
      * attention: softmax(QX @@ KX) @ VX
      * pattention: softmax(X @@ K) @@ V
      * so then it seems like we can ceate a hybrid where we do cross attention between X and concat(X, K) keys and concat(X, V) values where K and V are fixed and we always leave then unmasked
        * brings up some questions about balancing whether we are collecting information from the self attention portion or the pattention/"mlp" portion (esp the first row of a causal where we might have 1 self attention qk and 128 say qk mlp)
        * also about dimension matching: an mlp in attention mindset is like cross attention between a sequence of T and one of 4T at full dimension C; a multihead attention as is common is between T and T at dimension C/8 for 8 heads.
        * this leads to an uberformula for a hybrid like: `f(q(x) @@ concat(k(x), k'(x), K', K'')) @ concat(v(x), V', v'(x), V'') @ O`
          * q(x) can optionally be identity and optionally change dimension
          * you then are doing cross attention with a sequence of four parts where each part has an interaction between the keys/values that is dynamic/dynamic, dynamic/static, static/dynamic, static/static
          * mlp is static/static, normal attention is dynamic/dynamic, moe is static/dynamic, not sure if dynamic/static is already out there; linformer is dynamic/dynamic on a shortened sequence
          * each of these parts can be varied in size from 0 (omit) up to whatever
          * O is an output rescaling to get us back to dimension C
          * is this useful or known? todo write maybe a separate blog post about this, it seems like a cool way to blend attention+ff into one layer with adjustable ratio
    * noted in the top-k attention paper and augmenting self-attention with persistent memory
    * the concat idea is explored in augment self attention with persistent memory, though only with the dynamic/dynamic and static/static
* [GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints](https://arxiv.org/abs/2305.13245)
  * subsumes MQA (multi query attention) where key and value matrices are shared between heads
  * splits heads into k groups and shares key and value matrices between them
* [DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066)
  * MoE but with two changes:
    * increase number of experts (and decrease their hidden dim for constat param)
      * reasoning they give is more combinatorial paths, for top-2 with 16 experts you get choose(16, 2) = 120, at 4x you get choose(64, 8) = 4.4e9
    * and denote k of the experts as shared (always routed to) for "common knowledge"
  * similar (at a glance) expert balance and device balance loss for the router
  * they use this with an attention block as their arch
* [DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model](https://arxiv.org/abs/2405.04434)
  * uses above DeepSeekMoE as ff layer
  * reminder that kv cache in vanilla attention MHA caches the keys and values for each layer so 2CLT in total for C channel L layers T sequence length (and really C = Hh for H heads and h head dim)
  * introduces multi-head latent attenion (MLA): "low rank joint compression for keys and values to reduce KV cache"
    * down project (compress) tokens from C to c channels
      * for kv, we share a compressed vector and use two up-projection matrices to produce our normal keys and values
      * queries are also down and up projected
    * reduces kv cache to cLT for compressed dim c L layers T sequence length
    * decoupled rope: (fuzzy but this is my understanding)
      * choose a dim R for number of channels that will get positional encoding
      * downproject the compressed query from c to R and apply rope
      * downproject the original token from C to R and apply rope
      * concat these to the the queries and keys
        * so positional only affects R of the channels I think?
* [Patch-Level Training for Large Language Models](https://arxiv.org/abs/2407.12665)
  * to reduce training compute cost, first train a portion of dataset in patches, then in tokens
  * patches of length K are the avg of the K tokens' embedding
  * for a normal training sequence length L, patch training uses KL tokens to form K patches
  * loss function is next patch prediction which uses the logits for the ith patch to predict the K tokens (unordered) of the next patch
    * pushes the logits (after softmax) towards 1/K on the K tokens that are in the next patch
  * they train a disjoint fraction of the dataset on patches and then on tokens
    * is that optimal or just convenient to talk about fixed number of tokens trained on
    * ah but then do say if doing multiple epochs, you'd do a fraction on patches then the rest on tokens
  * is there a benefit to doing this in a multilevel fashion? Like first K=64, then 16, 4, 1?
* [Memory-efficient Transformers via Top-k Attention](https://arxiv.org/abs/2106.06899)
  * softmax(topk(Q @@ K)) @ V
    * interesting that the topk is before the softmax, which preserves the sum to 1
  * feed-forward as attention
    * as I was noting above in tokenformer, this is a noted thing; feed forward is like cross attention with fixed keys and values
* [Augmenting Self-attention with Persistent Memory](https://arxiv.org/abs/1907.01470)
  * concats learned-but-static K and V to the keys and values of a self attention layer that makes it a hybrid attention ffn; what I rambeld about above in tokenformer
* [DRew: Dynamically Rewired Message Passing with Delay](https://arxiv.org/abs/2305.08018) saw in [this vid](https://www.youtube.com/watch?v=m6xiIoizjQw)
  * me: aren't mpnn's and transformers basically the same? You just use the adjacency matrix as the attention bias?
  * anyways, the interesting idea that I thought might be interesting in the transformer context is this idea of having access to the hidden state from k steps ago
    * idk how that would look right now but writing this down for later
    * hand wavingly the more hops you do requires storing all the information you might need for later in your single token, so instead feed in the tokens from the k-previous layer (or k previous layers) so that you get more information
    * pretty different in language modeling where the adjacency matrix is either fully connected or trill
    * also gives me a silly idea for adding some kind of estimator for the token output based on the k previous tokens like exp avg or with momentum like adam or kalman or something
* [From Sparse to Soft Mixtures of Experts](https://arxiv.org/abs/2308.00951)
  * this one confused me for a bit
  * Sr is softmax over rows, Sc is softmax over columns
  * Y = Sr(XK)f(Sc(XK)^T X)
    * my K is their phi
    * from the view of attention, we have Sr(XK) which is like cross attention between tokens X and static (but learnable) keys K
    * K has shape (C, NP) though in the attention view it would be (NP, C) and we add a transpose
    * N is the number of experts and P is the number of slots
    * f is really fi and is a separate MLP (or whatever) and is run (independently) on each slot it gets
      * ie expert 0 gets slots 0 and 1, expert 1 gets slots 2 and 3 etc
    * Sr(XK) is the softmax over rows of attention and what they call the Combine matrix
      * for each token, how much of each expert's outputs (each slot of each expert) should I get
      * softmax over rows gives proportion based on how well that token matches each slot's K relative to the other slots
    * Sc(XK)^T is the softmax over columns of attention and what they call the Dispatch matrix
      * for each slot, how much of each token should I get
      * softmax over cols gives proportion based on how well that slot's K matches each token relative to the other tokens
    * Sc(XK)^T X does the combining of tokens into slots
  * more experts more better, even down to one slot per expert
  * so the routing is all based on a single vector, expert says "yo I prefer vectors in this cone"; what if you had multiple vectors to define a preferred span/volume/space?
  * not causal because K learns how to merge all tokens into slots
    * I think they're saying that even with a causal attention mask, you are then limiting which tokens each expert will get and so they'll be biased by their expert index
