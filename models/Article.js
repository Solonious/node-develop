/**
 * Created by sergeysolonar on 27.11.16.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var commentSchema = new Schema({
	rating:  {
		type: Number,
		min: 1,
		max: 5,
		required: true
	},
	comment:  {
		type: String,
		required: true
	},
	postedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	}
}, {
	timestamps: true
});

// create a schema
var acticleSchema = new Schema({
	heading: {
		type: String,
		required: true,
		unique: true
	},
	image: {
		type: String,
		required: true
	},
	category: {
		type: String,
		required: true
	},
	text: {
		type: String,
		required: true,
		default: ''
	},
	fullText : {
		type: String,
		default: ''
	},
	author: {
		type: String,
		required: true
	},
	description: {
		type: String,
		required: true
	},
	comments:[commentSchema]
}, {
	timestamps: true
});

// the schema is useless so far
// we need to create a model using it
var Articles = mongoose.model('Article', articleSchema);

// make this available to our Node applications
module.exports = Articles;