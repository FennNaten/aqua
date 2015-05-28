var Async = require('async');
var Config = require('../config');

var internals = {};

exports.register = function (server, options, next) {

    //the registration logic in internals.after will be executed on server start, and only after dependencies are fully registered. 
    server.dependency(['hapi-auth-cookie', 'hapi-mongo-models'], internals.after);

    next();
};

//all the registration logic depends on other plugins (uses schemes and plugins-specific space), so we extract it so that we can set it up to be fired only after dependency resolution
internals.after = function(server, next){

    var Session = server.plugins['hapi-mongo-models'].Session;
    var User = server.plugins['hapi-mongo-models'].User;


    server.auth.strategy('session', 'cookie', {
        password: Config.get('/cookieSecret'),
        cookie: 'sid-aqua',
        isSecure: false,
        redirectTo: '/login',
        validateFunc: function (data, callback) {

            Async.auto({
                session: function (done) {

                    var id = data.session._id;
                    var key = data.session.key;
                    Session.findByCredentials(id, key, done);
                },
                user: ['session', function (done, results) {

                    if (!results.session) {
                        return done();
                    }

                    User.findById(results.session.userId, done);
                }],
                roles: ['user', function (done, results) {

                    if (!results.user) {
                        return done();
                    }

                    results.user.hydrateRoles(done);
                }],
                scope: ['user', function (done, results) {

                    if (!results.user || !results.user.roles) {
                        return done();
                    }

                    done(null, Object.keys(results.user.roles));
                }]
            }, function (err, results) {

                if (err) {
                    return callback(err);
                }

                if (!results.session) {
                    return callback(null, false);
                }

                callback(null, Boolean(results.user), results);
            });
        }
    });


    next();
};

exports.preware = {};


exports.preware.ensureAdminGroup = function (groups) {

    return {
        assign: 'ensureAdminGroup',
        method: function (request, reply) {

            if (Object.prototype.toString.call(groups) !== '[object Array]') {
                groups = [groups];
            }

            var groupFound = groups.some(function (group) {

                return request.auth.credentials.roles.admin.isMemberOf(group);
            });

            if (!groupFound) {
                var response = {
                    message: 'Permission denied to this resource.'
                };

                return reply(response).takeover().code(403);
            }

            reply();
        }
    };
};


exports.register.attributes = {
    name: 'auth'
};
