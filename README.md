# Puffer — Adapted for Distributed Testing

Puffer ([puffer.stanford.edu](https://puffer.stanford.edu)) is a free and open-source live TV streaming website,
and also a research study at Stanford University using machine learning to
improve video streaming.

More details can be found
on the [website](https://puffer.stanford.edu/faq/),
in our [research paper](https://www.usenix.org/conference/nsdi20/presentation/yan)
(*Community Award* winner at NSDI 2020),
and in the [documentation](https://github.com/StanfordSNR/puffer/wiki/Documentation).

To perform distributed testing across different real-world environements, we adapted the original Puffer codebase 
to allow for server and client deployments on cloud providers incl. AWS and Azure across the globe. Further, we
enable using Amazon Mechanical Turks to collect performance data from real clients in different locations.
