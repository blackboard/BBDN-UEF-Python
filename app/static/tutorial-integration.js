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

var integrationHost = window.location.protocol + "//" + window.location.hostname
    + (window.location.port === "" ? "" : (":" + window.location.port));

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
        // Clear Any Local Storage from Last Usage. This is how we get around noticing the user logged out to clear local storage.
        // We clear it when they log in!

        //Create a logged message channel so messages are logged to the Javascript console
        messageChannel = new LoggedMessageChannel(evt.ports[0]);
        messageChannel.onmessage = onMessageFromUltra;

        localStorage.clear(); // MBK LOCALSTORAGE
  
        // Ultra is listening. Authorize ourselves using the REST token we received from 3LO
        // token is a variable set in index.html
        messageChannel.postMessage({
            type: 'authorization:authorize',
            token: token
        });
    }
  
}

// PROCTORING: called when our onMessageFromUltra message is in response to our proctoring service registration recieved.
const onProctoringServiceRegister = (msg) => {
    const proctoringServiceHandle = msg.data.proctoringPlacementHandle;
    const errorMsg = msg.data.errorMessage;
    console.log(`[UEF Tutorial] ${proctoringServiceHandle} registration response: ${msg.data.status}`);

    if (errorMsg) {
        console.log('errorMessage: ', msg.data.errorMessage);
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

    console.log('UEF TUTORIAL got message.data.type from Ultra:', message.data.type);
    console.log('UEF TUTORIAL got message.data.selector from Ultra:', message.data.selector);

    // PROCTORING: Check if our proctoring service registration was recieved.
    if (message.data.type === 'proctoring-service:register') {
        console.log('UEF TUTORIAL got proctoring-service:register message.')
        onProctoringServiceRegister(message)
    }    

    // Check to see if we received an Event...
    if (message.data.type === 'event:event') {
        console.log('[UEF TUTORIAL] got event')
        console.log('[UEF TUTORIAL] (route?) message.data.eventType:', message.data.eventType)

        // From here, you can do something with those events. Let's check for a click..
        if(message.data.eventType === 'route') {
            // Added this logging because UEF has added/changed routeName for user action in the past.
            console.log('[UEF TUTORIAL] Looking for base.admin.peek.course.outline.peek.content-manage.edit.document')
            console.log('[UEF TUTORIAL] Looking for base.courses.peek.course.outline.peek.content-manage.edit.document')
            console.log('[UEF TUTORIAL] Looking for base.recentActivity.peek.course.outline.peek.content-manage.edit.document')
            console.log('[UEF TUTORIAL] Got routeName', message.data.routeName)
            if ( message.data.routeName === 'base.admin.peek.course.outline.peek.content-manage.edit.document' ||
                 message.data.routeName === 'base.courses.peek.course.outline.peek.content-manage.edit.document' ||
                 message.data.routeName === 'base.recentActivity.peek.course.outline.peek.content-manage.edit.document'
            ) {                                 
                console.log('[UEF TUTORIAL] message.data.routeData.courseId:', message.data.routeData.courseId)
                console.log('[UEF TUTORIAL] message.data.routeData.id:',message.data.routeData.id)
                
                if (message.data.routeData.courseId === course_id) {
                    // You might think you need insert code here to ask Ultra to open a Course Banner
                    // You don't. When an Ultra course is opened, Ultra will always send us an event with course.banner.top  

                    if(message.data.routeData.id === content_id) {
                        
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
                    } // routeData.id matched our content_id

                } // routeData.courseId matched our courseId  
                
            }

        } // END if(message.data.eventType === 'route') {

        // COURSE-LEFTNAV course details. When we get the new portal with course outline details, show our version.
        if (message.data.eventType === 'portal:new' && message.data.selector === 'course.outline.details') {
            showCourseDetails(message.data.portalId, 'UEF cod Test', 'Click Here');
        }

        // PROCTORING && COURSE BANNERS: The event type is a new portal. Proctoring data is shown in a "portal" so is the Course Banner
        if (message.data.eventType === 'portal:new') {
            
            // Check if this matches a course banner selector
            if (message.data.selector === 'course.banner.top'){
                console.log('[UEF TUTORIAL COURSE BANNER] Got a portal:new for a course.banner.top selector.');
                showBanner(message.data.portalId);
            }// end this matches a course banner selector

            // Check if this matches the proctoring panel selector
            if (message.data.selector === 'course.content.assessment.settings.proctoring.panel.settings') {
                console.log('[UEF TUTORIAL PROCTORING] Got a portal:new with a course.content.assessment.settings.proctoring.panel.settings');
                // ID of this portal. This must be sent back to UEF in the portal:render message
                const portalId = message.data.portalId;
                    
                // contentId is included for convience in the selectorData
                console.log(message.data.selectorData.contentId);
                    
                const contentsToSend = {
                    tag: 'div',
                    children: [{
                        tag: 'div',
                        children: `Proctoring Service Settings`
                    }, {
                        tag: 'div',
                        children:  `courseUuid: ${message.data.selectorData.courseUuid}, contentId: ${message.data.selectorData.contentId}`
                    }]
                };
        
                // Send message to UEF to render this content
                messageChannel.postMessage({
                    type: "portal:render",
                    portalId: portalId,
                    contents: contentsToSend
                });
            } // END if (msg.data.selector === 'course.content.assessment.settings.proctoring.panel.settings') {
        } // END if (message.data.eventType === 'portal:new') {

        if (message.data.eventType === 'help:request') {
                // Ignore default help request from Ultra
                messageChannel.postMessage({
                    type: 'help:request:response',
                    correlationId: message.data.correlationId
                });
                // Let's ask Ultra to open a panel
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


    } // END if (message.data.type === 'event:event') {

    // Ultra has responded to our request to open a new panel...
    if (message.data.type === 'portal:panel:response') {
    
        // That means we have an iframe. Let's render our content there.
        renderPanelContents(message);
    
    }

    // PROCTORING: TODO: Add code to save off our settings...
    if (message.data.type === 'proctoring-service:settings-saved') {
        // Settings were saved for this contentId
        console.log(message.data.contentId);
         
        // Status of proctoring
        console.log(message.data.enabled);
      
      
        // Your response back to UEF after you have done what you need to
        messageChannel.postMessage({
           type: 'proctoring-service:settings-saved:response',
           correlationId: msg.data.correlationId,
           success: true,
           error: undefined
        });
     }

}

// Shows the link in course details COURSE-LEFTNAV.
// Notice the onClick will call back to our code.
function showCourseDetails (portalId, titleName, linkName) {
    messageChannel.postMessage({
        type: 'portal:render',
        portalId: portalId,
        contents: {
            tag: 'div',
            props: {
                className: 'uef--course-details--container',
            },
            children: [
                {
                    tag: 'button',
                    props: {
                        className: 'uef--button--course-details',
                        onClick: {
                            callbackId: 'course-details-test',
                            mode: 'sync',
                        }
                    },
                    children: [
                        {
                            tag: 'div',
                            props: {
                                className: 'uef--course-details--image'
                            },
                            children: [
                                {
                                    tag: 'img',
                                    props: {
                                        alt: 'Batman logo',
                                        src: 'https://img.icons8.com/material-sharp/1x/batman-emoji.png',
                                        height: 24,
                                        width: 24
                                    },
                                }
                            ]
                        },
                        {
                            tag: 'div',
                            props: {
                                className: 'uef--course-details--element'
                            },
                            children: [
                                {
                                    tag: 'div',
                                    props: {
                                        className: 'uef--course-details--name'
                                    },
                                    children: titleName
                                },
                                {
                                    tag: 'div',
                                    props: {
                                        className: 'uef--course-details--content'
                                    },
                                    children: [
                                        {
                                            tag: 'div',
                                            props: {
                                                className: 'uef--course-details--link'
                                            },
                                            children: linkName
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    });
} // end show course details

// Shows the Course Banner
function showBanner (portalId) {
 	messageChannel.postMessage({
		type: 'portal:render',
		portalId: portalId,
		contents: {
			tag: 'div',
			props: {
				style: {
					backgroundColor: '#c56fd5'
				}
			},
			children: [
				{
					tag: 'iframe',
					props: {
						src: banner_url,
						style: {
							flex: '1 1 auto',
							width: '100%',
						}
					}
				}
			]
		}
	});
}

/*
 * Called upon successful authorization. This registers our application as a listener with Ultra
 * and specifies the events we want to listen for
 */
function onAuthorizedWithUltra() {
    console.log('TUTORIAL successful authorization');
    console.log('window.location.origin:', window.location.origin);
    console.log('integrationHost:', integrationHost);
    console.log('iconUrl:' + integrationHost + '/static/blackboard-inc-logo-png-transparent-png.png');

    // PROCTORING - register our LTI Tool with the UEF.
    messageChannel.postMessage({
        type: 'proctoring-service:register',
        proctoringPlacementHandle: 'f74b87c285bb452685566123cb936b07'
    });

    // HELP
    messageChannel.postMessage({
        type: 'help:register',
        id: 'tutorial-help',
        displayName: 'Tutorial Help',
        providerType: 'auxiliary',
        iconUrl: integrationHost + '/static/tut.png'
    });

    messageChannel.postMessage({
        type: 'event:subscribe',
        subscriptions: ['click','hover','route','portal:new','portal:remove'],
    });

    //COURSE-LEFTNAV course detail - register to get the course:detail opening
    messageChannel.postMessage({
        type: "course:detail:register",
        registrationName: 'UEF course:detail Test',
    });

}

/*
 * This is the function that renders our content in the iFrame that Ultra gives us
 */
function renderPanelContents(message) {
    
    // Is this our peek panel??
    if (message.data.correlationId === 'panel-1') {
        
        // let's get our panel ID
        panelId = message.data.portalId;
      
        // Now we will tell Ultra we want to render our content in the iframe they opened for us.
        // panel_url is set IN index.html
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

    // Is this our course panel??
    if (message.data.correlationId === 'panel-2') {
        
        // let's get our panel ID
        panelId = message.data.portalId;
      
        // Now we will tell Ultra we want to render our content in the iframe they opened for us.
        // panel_url is set IN index.html
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

    } // course panel

} // function renderPanelContents

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
        console.log(`[UEF TUTORIAL] From Learn Ultra - evt:`, evt);
        console.log(`[UEF TUTORIAL] From Learn Ultra - evt.data:`, evt.data);
        this.onmessage(evt);
    };
  
    postMessage = (msg) => {
        console.log(`[UEF TUTORIAL] TO Learn Ultra`, msg);
        this.messageChannel.postMessage(msg);
    }

}