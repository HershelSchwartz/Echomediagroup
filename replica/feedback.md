# Feedback research

**Sample: 0 verbatim reviews.** Every review source the method calls for (App Store RSS, Google Play,
Trustpilot, Reddit, Hacker News) was unreachable from the build environment, so `reviews.csv` is
empty and `reviews.py` was not run. Nothing below is a quote, and no review was invented.

What follows is secondary research from public reports and analyses found by web search, each linked.
Treat it as a starting hypothesis, then fill `replica/reviews.csv` by hand (source,url,date,rating,text,
text copied exactly) and run:

    python3 .claude/skills/replica-entrepreneur/reviews.py replica/reviews.csv --out replica/feedback.md

## Themes from secondary sources

| theme | evidence | sources | strength |
| --- | --- | --- | --- |
| Cancellation fees charged when the driver caused the cancellation | A 2026 review analysis of 5,918 negative US Uber reviews found 246 about cancellation fees; 108 of those say the driver cancelled and the rider was charged anyway | [unstar.app, cancellation-fee analysis](https://unstar.app/blog/uber-charged-cancellation-fee-driver-cancelled-reviews-2026) | one source, self-sampled: thin |
| Fare surprises: quoted price jumps, unexpected fees | The same publisher reports price complaints at about a quarter of 1-star ride-sharing reviews (all apps, not only Uber); an older consumer-complaint listing cites duplicate and unexplained charges | [unstar.app, ride-sharing ranking](https://unstar.app/ru/blog/ride-sharing-app-reviews-uber-lyft-bolt-grab-2026), [FairShake](https://fairshake.com/uber/common-complaints/) | two sources, partly dated |
| Drivers can't see the platform's cut per trip | Academic audit: fares removed from drivers' weekly reports after dynamic pricing; Uber shows weekly average take rate since Jan 2025 but not per trip; take-rate estimates disputed by Uber | [ACM FAccT 2025](https://dl.acm.org/doi/full/10.1145/3715275.3732099), [arXiv](https://arxiv.org/html/2506.15278v1), [Yahoo Finance](https://finance.yahoo.com/economy/policy/articles/uber-driver-pay-falling-company-103000718.html), [Worker Info Exchange](https://www.workerinfoexchange.org/post/new-research-exposes-deepening-exploitation-of-uber-drivers-by-algorithmic-pay), [SF Public Press](https://www.sfpublicpress.org/drivers-protest-ubers-black-box-fare-system/) | five sources; advocacy and academic; Uber disputes figures |
| Driver deactivations without notice or a real appeal | AALDEF-led survey of 727 deactivated drivers: 70% of Uber deactivations had no prior notice; ACRE report: 96% of respondents called theirs unfair; Uber says under 2% of NYC drivers were permanently deactivated in H1 2025 | [Documented NY](https://documentedny.com/2025/10/29/majority-uber-lyft-drivers-deactivated-report-aaldef/), [ACRE report (PDF)](https://acrecampaigns.org/wp-content/uploads/2025/03/Driven-Out-by-AI-report.pdf), [HRW](https://www.hrw.org/report/2025/05/12/the-gig-trap/algorithmic-wage-and-labor-exploitation-in-platform-work-in-the-us) | three sources; self-selected surveys |
| Support that loops and forgets context | Anecdotal: forum posts about repeating the issue to each new agent; consumer-complaint site lists refunds as a top reason to contact | [Blind](https://www.teamblind.com/post/uber-customer-support-continues-to-be-really-bad-rhogtocv), [PissedConsumer](https://uber.pissedconsumer.com/customer-service.html) | anecdotal: thin |
