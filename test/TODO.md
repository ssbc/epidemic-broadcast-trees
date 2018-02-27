
test peer clocks:

test if remote is at zero, and you also are: do not send request.

DONE test if there is nothing to send, according to stored clock,
should still send {}

NOTE: If you request a feed that the remote blocks (sends -1)
then you block it too (you won't send anything)
and if they later follow that feed (they'll remember you sent a
+ number, so they'll request >=0, and then you'll request too)

test that non-integers passed in a clock are intepreted
as -1... or just abort the stream? (since we already have a
version flag? at least test it doesn't just crash the server)
