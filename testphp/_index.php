<?php
echo "TRYING TO CONNECT";
$conn =  new mysqli('162.210.70.16', 'admin', 'vjb@1234', 'juggernaut');

if (mysqli_connect_errno($con))
  {
  echo "Failed to connect to MySQL: " . mysqli_connect_error();
  }
  
$result = $conn->query("SELECT message FROM test;");
$row = $result->fetch_assoc();
echo $row['message'];
?>