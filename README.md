# BBDN-UEF-Python

This project is set up to demonstrate the use of the Ultra Extension Framework with LTI 1.3 in Python.

To configure:

## app/Config.py, app/lti.json, app/private.key, and app/public.key

The source project for this project, [tutorials/py-lti-1p3](https://docs.blackboard.com/standards/lti/tutorials/py-lti-1p3) shows how to configure the PyLTI1.3 library, which is done through it's `configs`directory. This project has no `configs` directory. Instead, all configuration is in files in the `app` directory.

## ConfigTemplate.py

Copy `ConfigTemplate.py` to `Config.py` and fill in your information:

```
config = {
    "verify_certs" : "True",
    "learn_rest_url" : "YOURLEARNSERVERNOHTTPS",
    "learn_rest_key" : "YOURLEARNRESTKEY",
    "learn_rest_secret" : "YOURLEARNRESTSECRET",
    "app_url" : "YOURAPPURLWITHHTTPS"
}
```

* **learn_rest_url** should be set to your learn instances domain. Be sure to AVOID the request scheme, i.e. `mylearn.blackboard.edu`
* **app_url** should be set to the FQDN of your application, i.e. `https://myapp.herokuapp.com`
* **courses** maps the course Pk1 to the title you wish to to assign it
* **courseIds** is a comma-delimeted list of course ids to listen for events from
* **contents** maps content pk1 values to the title you wish to assign it
* **contentIds** is a comman-delimited list of content Ids to listen for events from

## lti-template.json
Copy `lti-template.json` to `lti.json` and fill in your information:
```
{
    "https://blackboard.com": {
        "client_id": "clientId",
        "auth_login_url": "https://developer.blackboard.com/api/v1/gateway/oidcauth",
        "auth_token_url": "https://developer.blackboard.com/api/v1/gateway/oauth2/jwttoken",
        "key_set_url": "https://developer.blackboard.com/api/v1/management/applications/clientId/jwks.json",
        "key_set": null,
        "private_key_file": "private.key",
        "public_key_file": "public.key",
        "deployment_ids": ["deploymentId"]
    }
}
```
* **clientId** set to your application's application ID you got from registration. For LTI, this is the client_id.
* **private.key** create a file in your app directory. ex: openssl genrsa -out private.key 4096
* **public.key** create the associated public.key file in your app directory. ex: openssl rsa -in private.key -pubout -out public.key
* **deployment_ids** Beweeen the quote characters, place the deployment Id you got when you registered the client_id on the Learn LTI page.

## To Run

First run `pip install -r requirements.txt`  and then `python app.py` or if you are using heroku, just check in the code to your dyno.
