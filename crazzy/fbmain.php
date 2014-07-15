<?php

	$fbconfig['appid' ]     = "563026260414467";
	$fbconfig['secret']     = "8aaf4952502a6ecb7b893fe2f3cc0dd5";
	$fbconfig['baseurl']    = "http://www.juggernaut-studios.com/crazzy/index.php";
    $fbconfig['appBaseUrl'] = "http://apps.facebook.com/crazzybird";  

    
   
    if (isset($_GET['code'])){
        header("Location: " . $fbconfig['appBaseUrl']);
        exit;
    }
    //~~
    
    //
    if (isset($_GET['request_ids'])){
       
    }
    
    $user            =   null; //facebook user uid
    try{
        include_once "facebook.php";
    }
    catch(Exception $o){
       
    }
    // Create our Application instance.
    $facebook = new Facebook(array(
      'appId'  => $fbconfig['appid'],
      'secret' => $fbconfig['secret'],
      'cookie' => true,
    ));

    //Facebook Authentication part
    $user       = $facebook->getUser();
    // We may or may not have this data based 
    // on whether the user is logged in.
    // If we have a $user id here, it means we know 
    // the user is logged into
    // Facebook, but we don’t know if the access token is valid. An access
    // token is invalid if the user logged out of Facebook.
    
    $loginUrl   = $facebook->getLoginUrl(
            array(
				
                'scope'         => 'email,publish_stream,user_birthday,user_location,,user_photos'

				
            )
    );

    if ($user) {
      try {
        // Proceed knowing you have a logged in user who's authenticated.
        $user_profile = $facebook->api('/me');

      } catch (FacebookApiException $e) {
        //you should use error_log($e); instead of printing the info on browser
        d($e);  // d is a debug function defined at the end of this file
        $user = null;
      }
    }

    if (!$user) {
        echo "<script type='text/javascript'>top.location.href = '$loginUrl';</script>";
        exit;
    }
    
    //get user basic description
    $userInfo           = $facebook->api("/$user");
//echo "<pre>";print_r($userInfo);
    function d($d){
        echo '<pre>';
        print_r($d);
        echo '</pre>';
    }
?>
 