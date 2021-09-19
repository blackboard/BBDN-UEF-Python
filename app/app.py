import datetime
import os
import pprint
import uuid
import urllib
import webbrowser
import json

from distutils import util

import string
import secrets

from urllib.parse import urlparse
from urllib.parse import unquote

from tempfile import mkdtemp

from flask import Flask, jsonify, request, render_template, url_for, redirect, Response
from flask_caching import Cache
from flask_login import LoginManager, UserMixin, current_user, login_user, login_required, logout_user
from flask_debugtoolbar import DebugToolbarExtension
from flask.helpers import make_response

from werkzeug.exceptions import Forbidden

from pylti1p3.contrib.flask import FlaskOIDCLogin, FlaskMessageLaunch, FlaskRequest, FlaskCacheDataStorage
from pylti1p3.deep_link_resource import DeepLinkResource
from pylti1p3.grade import Grade
from pylti1p3.lineitem import LineItem
from pylti1p3.tool_config import ToolConfJsonFile
from pylti1p3.registration import Registration

import Config

import RestAuthController



class ReverseProxied(object):
    def __init__(self, app):
        self.app = app

    def __call__(self, environ, start_response):
        scheme = environ.get('HTTP_X_FORWARDED_PROTO')
        if scheme:
            environ['wsgi.url_scheme'] = scheme
        return self.app(environ, start_response)


app = Flask('ultra-extension-framework-sample', template_folder='templates', static_folder='static')

app.wsgi_app = ReverseProxied(app.wsgi_app)

config = {
    "DEBUG": False,
    "ENV": "production",
    "CACHE_TYPE": "simple",
    "CACHE_DEFAULT_TIMEOUT": 600,
    "SECRET_KEY": "EF186261-4F2E-4CCC-9C5C-6935CF0262F4",
    "SESSION_TYPE": "filesystem",
    "SESSION_FILE_DIR": mkdtemp(),
    "SESSION_COOKIE_NAME": "flask-session-id",
    "SESSION_COOKIE_HTTPONLY": True,
    "SESSION_COOKIE_SECURE": True,  # should be True in case of HTTPS usage (production)
    "SESSION_COOKIE_SAMESITE": "None",  # should be 'None' in case of HTTPS usage (production)
    "DEBUG_TB_INTERCEPT_REDIRECTS": False
}
app.config.from_mapping(config)

cache = Cache(app)

toolbar = DebugToolbarExtension(app)

login_manager = LoginManager()
login_manager.init_app(app)


PAGE_TITLE = 'Ultra Extension Framework Sample'

class User(UserMixin):

    def __init__(self, user_id):
        self.id = user_id
        self.email = None
        
    def getEmail(self):
        return self.email
    
    def setEmail(self, email):
        self.email = email

class ExtendedFlaskMessageLaunch(FlaskMessageLaunch):

    def validate_nonce(self):
        """
        Probably it is bug on "https://lti-ri.imsglobal.org":
        site passes invalid "nonce" value during deep links launch.
        Because of this in case of iss == http://imsglobal.org just skip nonce validation.
        """
        iss = self.get_iss()
        deep_link_launch = self.is_deep_link_launch()
        if iss == "http://imsglobal.org" and deep_link_launch:
            return self
        return super(ExtendedFlaskMessageLaunch, self).validate_nonce()


def get_lti_config_path():
    return os.path.join(app.root_path, 'lti.json')


def get_launch_data_storage():
    return FlaskCacheDataStorage(cache)


def get_jwk_from_public_key(key_name):
    key_path = os.path.join(app.root_path, '..', 'configs', key_name)
    f = open(key_path, 'r')
    key_content = f.read()
    jwk = Registration.get_jwk(key_content)
    f.close()
    return jwk

def parseUserId():

    user_id = current_user.id.split()

    return user_id[0], user_id[1]


@login_manager.unauthorized_handler
def unauthorized():
    return(Response('Must be a valid LTI connection.', status=403))

@login_manager.user_loader
def load_user(user_id):
    """Check if user is logged-in on every page load."""
    if user_id is not None:
        return User(user_id)
    return None

@app.route('/', methods=['GET'])
def test():
    return('<h1>Your docker container is sucessfully being served by ngrok from your desktop!</h1>')


@app.route('/jwks/', methods=['GET'])
def get_jwks():
    tool_conf = ToolConfJsonFile(get_lti_config_path())
    return jsonify({'keys': tool_conf.get_jwks()})

@app.route('/login/', methods=['GET', 'POST'])
def login():
    tool_conf = ToolConfJsonFile(get_lti_config_path())
    launch_data_storage = get_launch_data_storage()

    flask_request = FlaskRequest()
    target_link_uri = flask_request.get_param('target_link_uri')
    
    if not target_link_uri:
        raise Exception('Missing "target_link_uri" param')

    oidc_login = FlaskOIDCLogin(flask_request, tool_conf, launch_data_storage=launch_data_storage)
    return oidc_login\
        .enable_check_cookies()\
        .redirect(target_link_uri)


@app.route('/launch/', methods=['HEAD','GET','POST'])
def launch():
    tool_conf = ToolConfJsonFile(get_lti_config_path())
    flask_request = FlaskRequest()
    launch_data_storage = get_launch_data_storage()
    message_launch = ExtendedFlaskMessageLaunch(flask_request, tool_conf, launch_data_storage=launch_data_storage)
    message_launch_data = message_launch.get_launch_data()
    pprint.pprint(message_launch_data)
    tpl_kwargs = {
        'page_title': PAGE_TITLE,
        'is_deep_link_launch': message_launch.is_deep_link_launch(),
        'launch_data': message_launch.get_launch_data(),
        'launch_id': message_launch.get_launch_id(),
        'curr_user_name': message_launch_data.get('name', '')
    }
    
    learn_url = message_launch_data['https://purl.imsglobal.org/spec/lti/claim/tool_platform']['url'].rstrip('/')

    # Rererence: https://docs.blackboard.com/blog/2021/05/10/use-one-time-session-tokens-instead-of-cookies-for-UEF-authentication.html
    # Get the value of the one time session token from the LTI claim
    one_time_session_token  = message_launch_data['https://blackboard.com/lti/claim/one_time_session_token']

    # If there is no comma in the value, we've hit the bug. Add it and the user's UUID
    if "," not in one_time_session_token:
        one_time_session_token += "," + message_launch_data['sub']

    params = {
        'redirect_uri' : Config.config['app_url'] + '/authcode/',
        'response_type' : 'code',
        'client_id' : Config.config['learn_rest_key'],
        'scope' : '*',
        'state' : str(uuid.uuid4()),
	    'one_time_session_token' : one_time_session_token
    }

    encodedParams = urllib.parse.urlencode(params)

    get_authcode_url = learn_url + '/learn/api/public/v1/oauth2/authorizationcode?' + encodedParams

    print("authcode_URL: " + get_authcode_url)

    return(redirect(get_authcode_url))

@app.route('/authcode/', methods=['GET', 'POST'])
def authcode():
    
    authcode = request.args.get('code', '')
    state = request.args.get('state', '')
    print (authcode)
    
    restAuthController = RestAuthController.RestAuthController(authcode)
    restAuthController.setToken()
    token = restAuthController.getToken()
    uuid = restAuthController.getUuid()

    login_user(User(uuid))

    tp_kwargs = {
        'title' : PAGE_TITLE,
        'learn_url' : 'https://' + Config.config['learn_rest_url'],
        'token' : token,
        'panel_url' : Config.config['app_url'] + '/helloworld/',
        'course_id' : '_3_1',
        'content_id' : '_18_1'
    }

    return render_template('index.html', **tp_kwargs)

@app.route('/helloworld/', methods=['GET', 'POST'])
@login_required
def sayhello():
    coursesOrOrganizations = request.args.get('coursesOrOrganizations', 'No coursesOrOrganizations Specified')

    return render_template('helloworld.html', coursesOrOrganizations=coursesOrOrganizations)

if __name__ == '__main__':
    restAuthController = None
    app.run(host='0.0.0.0', port=5000)