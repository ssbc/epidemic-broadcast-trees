

/*
  progress states

  received remote note, not yet ours *
  have our note, not yet theirs

  we are both at the same sequence (sync) 0
  we are ahead (send) -1
  they are ahead (recieve) 1

  * this might happen because we don't know about that feed yet.
    since currently, it just automatically replicates everything
    that is asked for.
*/
