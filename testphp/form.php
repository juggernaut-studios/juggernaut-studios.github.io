<?php

// create email headers
$sender = $_POST['sender'];
 $comments = $_POST['comments'];
@mail('contact@juggernaut-studios.com', $sender ,  $comments); 
echo "TRYING TO CONNECT";
?>