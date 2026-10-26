# Stanford on GitHub

**<https://matmat202.github.io/stanford-on-github/>**

Every public repo from the GitHub organisations of Stanford's labs, courses and student
groups, ranked by stars: DSPy, STORM, Stanford Alpaca, CoreNLP, Stanza, GloVe, ColBERT,
ThunderKittens, HELM, OGB, and about 2,300 more. Filter to labs, courses or clubs, pick a
language, see what was created in the last year or pushed most recently, and click any
group to see everything it has published.

**Good first issues** lists the open issues labelled *good first issue* or *help wanted*
across all of those repos: unassigned, newest first, and by default only in repos someone
has pushed to in the last six months, so there is a maintainer around to review the PR.

## Which groups count

GitHub's organisation search for "stanford" finds about 850 orgs. An org is kept if its
own profile says Stanford, in its login, name, description, website, email or location.
That is self-description, not verification. One lab is added by hand because its profile
never says so: **tatsu-lab** (Tatsunori Hashimoto's group, home of Stanford Alpaca).
Code that Stanford people publish under personal accounts is not here.

Forks are dropped (a fork's stars belong to the original), and so are repos under three
stars: most of the ~7,000 originals have none.

"Course" and "club" are read from each profile's wording: a catalogue number like CS336
or the word *course* makes a course; *club*, *students* or *hackathon* makes a club.
*Team* deliberately does not, because Stanford MAST, Stanford Web Services and the HIVDB
team all call themselves one.

`./refetch.sh` re-pulls everything through the local `gh` CLI (~1,500 API calls).

Not affiliated with Stanford University or GitHub. Built by Claude.
