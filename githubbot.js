var builder = require('botbuilder');
var restify = require('restify');
var githubClient = require('./github-client.js');

var connector = new builder.ChatConnector();
var bot = new builder.UniversalBot(
	connector,
	function(session) {
		session.endConversation(`Hi there! I'm a GitHub bot. I'll help you find GitHub users`);
	}
);

bot.dialog('search', [
	function(session,args,next) {
		if(session.message.text.toLowerCase() == 'search'){
			builder.Prompts.text(session, 'Whom did you want to search for?');
		}
		else{
			var query = session.message.text.substring(7);
			next({ response:query });
		}
	},
	
	function(session,results,next) {
		var query = results.response;
		if(!query) {
			session.endDialog('Request cancelled');
		}
		else{
			githubClient.executeSearch(query, function(profiles) {
				var totalCount = profiles.total_count;
				if(totalCount == 0){
					session.endDialog('Sorry no results found!');
				}
				else if(totalCount > 10){
					session.endDialog('More than 10 results were found. Please provide more specific query');
				}
				else{
					var usernames = profiles.items.map(function (item) { return item.login });
                    builder.Prompts.choice(
						session,
						`Please choose a user`,
						usernames,
						{listStyle: builder.ListStyle.button}
 					)
				}
			});
		}
	},
	
	function(session,results,next) {
		session.sendTyping();
		githubClient.loadProfile(results.response.entity, function(profile) {
			var card = new builder.HeroCard(session);
			
			card.title(profile.login);
			
			card.images([builder.CardImage.create(session, profile.avatar_url)]);
			
			if(profile.name) card.subtitle(profile.name);
			
			var text = '';
			if(profile.company) text += profile.company + '\n\n';
			if(profile.email) text += profile.email + '\n\n';
			if(profile.bio) text += profile.bio;
			card.text(text);
			
			card.tap(new builder.CardAction.openUrl(session, profile.html_url));
			
			var message = new builder.Message(session).attachments([card]);
			session.endConversation(message);
		});
	}
]).triggerAction({
	matches: /^search/i
})

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});
server.post('/api/messages', connector.listen());
		