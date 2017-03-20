# epidemic-broadcast-trees

This is an implementation of the plumtree Epidemic Broadcast Trees paper.
It's a algorithm that combines the robustness of a flooding epidemic gossip broadcast,
with the efficiency of a tree model. It's intended for implementing realtime protocols
(such as chat, scuttlebutt, also radio/video) over networks with random topology -
or networks where otherwise peers may be unable to all connect to each other or to a central hub.

Although the primary motivation for this module is to use it in secure scuttlebutt,
it's intended to be decoupled sufficiently to use for other applications.

## License

MIT














