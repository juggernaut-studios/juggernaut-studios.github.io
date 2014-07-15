<?php
/**
 * Copyright 2011 Facebook, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */

require 'facebook-sdk/src/facebook.php';

// Create our Application instance (replace this with your appId and secret).
$fbconfig = array();
$fbconfig['appid']      = "563026260414467";
$fbconfig['secret']     = "f646220ae9c5ec2bbeeded4d51021552";
$fbconfig['baseurl']    = "http://www.juggernaut-studios.com/crazzy/index.php";
	
$facebook = new Facebook(array(
  'appId'  => $fbconfig['appid'],
  'secret' => $fbconfig['secret'],
));

// Get User ID
$user = $facebook->getUser();

// We may or may not have this data based on whether the user is logged in.
//
// If we have a $user id here, it means we know the user is logged into
// Facebook, but we don't know if the access token is valid. An access
// token is invalid if the user logged out of Facebook.

if ($user) {
  try {
    // Proceed knowing you have a logged in user who's authenticated.
    $user_profile = $facebook->api('/me');
  } catch (FacebookApiException $e) {
    error_log($e);
    $user = null;
  }
}


// Login or logout url will be needed depending on current user state.
if ($user) {
  $logoutUrl = $facebook->getLogoutUrl();
} else {
  $loginUrl   = $facebook->getLoginUrl(
            array(
                'scope'         => 'email,offline_access,publish_stream,user_birthday,user_about_me',
                'redirect_uri'  => $fbconfig['baseurl']
            )
    );
}


?>
<!doctype html>
<html xmlns:fb="http://www.facebook.com/2008/fbml">
  <head>
    <title>crazzybird</title>
    <style>
      body {
        font-family: 'Lucida Grande', Verdana, Arial, sans-serif;
		color:#ccc;
      }
      a {
        text-decoration: none;
        color: #000;
		background-color:#ccc;
		padding:5px;
      }
      a:hover {
        text-decoration: none;
		background-color:#fff;
		color:#333;
      }
    </style>
	
  </head>
  <body>
  	<div id='fb-root'></div>
   <!-- <h1>CRAZZY BIRDS</h1>-->

   <div style="margin:20px;"><?php include_once("index1.html"); ?></div>

	
    <div style="margin:20px;"><a href="javascript:publish_to_wall();">Publish to your wall</a></div>
    <p id='msg'></p>

    <script> 
	
	window.fbAsyncInit = function() 
	{
		FB.init({
			appId: <?php echo $fbconfig['appid'];?>, 
			status: true, 
			cookie: true,   
			xfbml: true
			});
	};(function() 
	{ 
		var e = document.createElement('script'); 
		e.async = true;
	    e.src = document.location.protocol +   '//connect.facebook.net/en_US/all.js';
	    document.getElementById('fb-root').appendChild(e);  
	 }());

    </script>
	
	<script>
	function publish_to_wall()
	{
		 FB.ui(
		   {
			 method: 'feed',
			 name: 'Dialogs title',
			 link: 'http://www.juggernaut-studios.com/',
			 picture: 'http://www.juggernaut-studios.com/crazzy/images.jpg',
			 caption: 'Reference Caption here',
			 description: 'Dialogs descriptions',
			 message: 'Facebook Dialogs are easy!'
		   },
		   function(response) {
			 if (response && response.post_id) {
			  // alert('Post was published.');
			 } else {
			   //alert('Post was not published.');
			 }
		   }
		 );
	}
	</script>
  </body>
</html>
