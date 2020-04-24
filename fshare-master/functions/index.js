const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });


exports.onCreateFollower = functions.firestore.document("/followers/{userId}/userFollowers/{followerId}").onCreate(async (snapshot, context) => {
console.log("follower created", snapshot.data());
const userId = context.params.userId;
const followerId = context.params.followerId;

//get followed users posts
const followedUserPostRef = admin.firestore().collection('posts').doc(userId).collection('userPosts');

//get following users's timeline
const timelinePostRef = admin.firestore().collection('timeline').doc(followerId).collection('timelinePosts');

//get followed users posts
const querySnapshot = await followedUserPostRef.get();

//add each user post to following users timeline
querySnapshot.forEach(doc => {
 if(doc.exists){
 const postId = doc.id;
 const postData = doc.data();
 timelinePostRef.doc(postId).set(postData);
 }
});
});


exports.onDeleteFollower = functions.firestore.document("/followers/{userId}/userFollowers/{followerId}").onDelete(async (snapshot, context) => {
 console.log("Follower Deleted", snapshot.id);

const userId = context.params.userId;
const followerId = context.params.followerId;

const timelinePostsRef = admin.firestore().collection("timeline").doc(followerId).collection("timelinePosts").where("ownerId", "==", userId);

const querySnapshot = await timelinePostsRef.get();
querySnapshot.forEach(doc => {
if(doc.exists){
doc.ref.delete();
};
});

});

//when a post is created , add post to timeline of each follower (of post owner)

exports.onCreatePost = functions.firestore.document('/post/{userId}/userPosts/{postId}').onCreate(async (snapshot, context) => {
const postCreated = snapshot.data();
const userId = context.params.userId;
const postId = context.params.postId;

//get all the followers of the user who made the post

const userFollowersRef = admin.firestore().collection('followers').doc(userId).collection('userFollowers');
const querySnapshot = await userFollowersRef.get();

//add new post to each follower's timeline

querySnapshot.forEach(doc => {
const followerId = doc.id;
admin.firestore().collection('timeline').doc(followerId).collection('timelinePosts').doc(postId).set(postCreated);
});
});

//to update
exports.onUpdatePost = functions.firestore.document('/posts/{userId}/userPosts/{postId}').onUpdate(async (change, context) => {
const postUpdated = change.after.data();
const userId = context.params.userId;
const postId = context.params.postId;
const userFollowersRef = admin.firestore().collection('followers').doc(userId).collection('userFollowers');

const querySnapshot = await userFollowersRef.get();

querySnapshot.forEach(doc => {
const followerId = doc.id;
admin.firestore().collection('timeline').doc(followerId).collection('timelinePosts').doc(postId).get().then(doc => {
if(doc.exists){
doc.ref.update(postUpdated);
}
});
});
});



exports.onDeletePost = functions.firestore.document('/posts/{userId}/userPosts/{postId}').onDelete(async (snapshot, context) => {
const userId = context.params.userId;
const postId = context.params.postId;
const userFollowersRef = admin.firestore().collection('followers').doc(userId).collection('userFollowers');

const querySnapshot = await userFollowersRef.get();

querySnapshot.forEach(doc => {
const followerId = doc.id;
admin.firestore().collection('timeline').doc(followerId).collection('timelinePosts').doc(postId).get().then(doc => {
if(doc.exists){
doc.ref.delete();
}
});
});
});


exports.onCreateActivityFeedItem = functions.firestore.document('/feed/{userId}/feedItems/{activityFeedItem}')
.onCreate(async (snapshot, context) => {
console.log('Activity Feed Item Created', snapshot.data());

//get user connected to the feed
const userId = context.params.userId;

const userRef = admin.firestore().doc(`users/${userId}`);
const doc = await userRef.get();

// once we have user, check if they have a notification token

const androidNotificationToken = doc.data().androidNotificationToken;
const createdActivityFeedItem = snapshot.data();

if(androidNotificationToken){
//send info
sendNotification(androidNotificationToken, createdActivityFeedItem);
}else{
console.log("no token for user");
}
function sendNotification(androidNotificationToken, activityFeedItem){
let body;
//switch body value based off of notification type
switch(activityFeedItem.type){
case "comment":
   body = `${activityFeedItem.username} replied: ${activityFeedItem.commentData}`;
   break;
case "like":
   body = `${activityFeedItem.username} liked your post`;
   break;
case "follow":
   body = `${activityFeedItem.username} started following you`;
   break;
default:
   break;

}
//create msg for push notif

const message = {
notification: { body },
token: androidNotificationToken,
data: {recipient: userId}
};

//send msg with admin.messaging()

admin.messaging().send(message).then(response => {
//response is a msg id string
console.log("Successfully sent msg", response);
}).catch(error => {
console.log("Error sending message", error);
});

}

});