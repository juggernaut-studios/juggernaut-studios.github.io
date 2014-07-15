<?php

     
    // EDIT THE 2 LINES BELOW AS REQUIRED
    $email_to = "deviator206@gmail.com";
    $email_subject = "Response From WEBSITE";
   
    $comments = $_POST['comments']; // required
    $email_message .= "Comments: "$comments"\n";
     
     
// create email headers
$headers = 'From: '.$email_from."\r\n".
'Reply-To: '.$email_from."\r\n" .
'X-Mailer: PHP/' . phpversion();
@mail($email_to, $email_subject, 'KILLER CHOKRA ' , $headers);  
?>
 
<!-- include your own success html here -->
 
Thank you for contacting us. We will be in touch with you very soon.
