# LYRA stable baseline

Production baseline intentionally restored to commit `b0d0324499d447be22ff109c0ba6cca12f715507` after rejecting the prior global UX layer as insufficiently isolated.

Rules for future promotion:
- test visual changes in preview first;
- no global DOM behavior changes unless module impact is proven;
- no promotion while functional reconciliation is incomplete;
- keep Maestro data reconciliation frozen at zero differences.
