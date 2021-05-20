/*
 * Copyright (C) 2019, Blackboard Inc.
 * All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 *  -- Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *
 *  -- Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 *
 *  -- Neither the name of Blackboard Inc. nor the names of its contributors
 *     may be used to endorse or promote products derived from this
 *     software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY BLACKBOARD INC ``AS IS'' AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL BLACKBOARD INC. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

// Verify that we're in the integration iframe
if (!window.parent) {
    throw new Error('Not within iframe');
}

/* Initialize messageChannel */
let messageChannel;

// Initialize panelId. This is used to keep track of our open panels between functions
let panelId

/* Add an event listener to listen for messages. When one is received, call onPostMessageReceived() */
window.addEventListener("message", onPostMessageReceived, false);

/* Post a message to tell Ultra we are here. learn_url is a variable set in index.html  */
window.parent.postMessage({"type": "integration:hello"}, learn_url + '/*');

/*
 * Called when we receive a message. 
 */
function onPostMessageReceived(evt) {

    // Determine whether we trust the origin of the message. learn_url is a variable set in index.html
    const fromTrustedHost = evt.origin === window.__lmsHost || evt.origin === learn_url;

    if (!fromTrustedHost || !evt.data || !evt.data.type) {
        return;
    }

    // If Ultra is responding to our hello message
    if (evt.data.type === 'integration:hello') {

        //Create a logged message channel so messages are logged to the Javascript console
        messageChannel = new LoggedMessageChannel(evt.ports[0]);
        messageChannel.onmessage = onMessageFromUltra;
  
        // Ultra is listening. Authorize ourselves using the REST token we received from 3LO
        // token is a variable set in index.html
        messageChannel.postMessage({
            type: 'authorization:authorize',
            token: token
        });
    }
  
}

/*
 * Called when our message processor receives amessage from Ultra. 
 */
function onMessageFromUltra(message) {
    
    // We received a message from Ultra stating that our authorization request was successful.
    if (message.data.type === 'authorization:authorize') {
      onAuthorizedWithUltra();
    }

    // Check to see if we received an Event...
    if (message.data.type === 'event:event') {
        console.log('TUTORIAL got event')
        console.log('TUTORIAL (route?) message.data.eventType:', message.data.eventType)
        // From here, you can do something with those events. Let's check for a click..
        if(message.data.eventType === 'route') {
            // Added this logging because UEF has added/changed routeName for user action in the past.
            console.log('LOOKING FOR base.admin.peek.course.outline.peek.content-manage.edit.document')
            console.log('LOOKING FOR base.courses.peek.course.outline.peek.content-manage.edit.document')
            console.log('LOOKING FOR base.recentActivity.peek.course.outline.peek.content-manage.edit.document')
            console.log('TUTORIAL GOT A ROUTE routeName', message.data.routeName)
            if ( message.data.routeName === 'base.admin.peek.course.outline.peek.content-manage.edit.document' ||
                 message.data.routeName === 'base.courses.peek.course.outline.peek.content-manage.edit.document' ||
                 message.data.routeName === 'base.recentActivity.peek.course.outline.peek.content-manage.edit.document'
            ) {                                 
                console.log('TUTORIAL message.data.routeData.courseId:', message.data.routeData.courseId)
                console.log('TUTORIAL message.data.routeData.id:',message.data.routeData.id)
                if(message.data.routeData.courseId === course_id && message.data.routeData.id === content_id) {
                    
                    // So let's ask Ultra to open a panel
                    setTimeout(() => {
                        messageChannel.postMessage({
                            type: 'portal:panel',
                            correlationId: 'panel-1',
                            panelType: 'small',
                            panelTitle: 'Hello World',
                            attributes: {
                                onClose: {
                                    callbackId: 'panel-1-close',
                                },
                                onClick: {
                                    callbackId: 'panel-1-close',
                                },
                            },
                        });
                    }, 2000);
                }

            }

        }

    }

    // Ultra has responded to our request to open a new panel...
    if (message.data.type === 'portal:panel:response') {
    
        // That means we have an iframe. Let's render our content there.
        renderPanelContents(message);
    
    }

}

/*
 * Called upon successful authorization. This registers our application as a listener with Ultra
 * and specifies the events we want to listen for
 */
function onAuthorizedWithUltra() {
    console.log('tutorial successful authorization')
    messageChannel.postMessage({
        type: 'event:subscribe',
        subscriptions: ['click','hover','route','portal:new','portal:remove'],
    });

}

/*
 * This is the function that renders our content in the iFrame that Ultra gives us
 */
function renderPanelContents(message) {
    
    // Is this our panel??
    if (message.data.correlationId === 'panel-1') {
        
        // let's get our panel ID
        panelId = message.data.portalId;
      
        // Now we will tell Ultra we want to render our content in the iframe they opened for us.
        // panel_url is set in index.html
        messageChannel.postMessage({
            type: 'portal:render',
            portalId: message.data.portalId,
            contents: {
                tag: 'span',
                props: {
                    style: {
                        display: 'flex',
                        height: '100%',
                        width: '100%',
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        justifyContent: 'stretch',
                    },
                },
                children: [{
                    tag: 'iframe',
                    props: {
                        style: {
                            flex: '1 1 auto',
                        },
                        src: panel_url,
                    },
                }]
            },
        });

    }

}

/**
 * A MessageChannel-compatible API, but with console logging.
 */
class LoggedMessageChannel {

    onmessage = () => { 
        console.log('test');
    };
  
    constructor(messageChannel) {
        this.messageChannel = messageChannel;
        this.messageChannel.onmessage = this.onMessage;
    }
  
    onMessage = (evt) => {
        console.log(`[UEF] FROM Learn Ultra:`, evt.data);
        this.onmessage(evt);
    };
  
    postMessage = (msg) => {
        console.log(`[UEF] TO Learn Ultra`, msg);
        this.messageChannel.postMessage(msg);
    }

}