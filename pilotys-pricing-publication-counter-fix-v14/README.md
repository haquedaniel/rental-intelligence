# Pilotys publication counter fix v14

Fixes a post-success `NameError` caused by an obsolete `already_written` variable. The bug marked successfully accepted writes as failed and caused the same actions to be retried forever.

After installation, rerunning the publisher reconciles preserved successful acknowledgements without resending them, then continues through the remaining queue.
