-- TODO: Upgrade/install?

CREATE TABLE versions (
	id_version int(10) unsigned NOT NULL auto_increment,
	value int(10) unsigned NOT NULL DEFAULT 0 COMMENT 'Numeric value of the version, may have duplicates.',
	title varchar(32) CHARACTER SET latin1 NOT NULL,
	PRIMARY KEY (id_version),
	KEY value (id_version, value),
	UNIQUE KEY title (title)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE games (
	id_game char(14) CHARACTER SET latin1 NOT NULL COMMENT 'Without hyphen.',
	title varchar(255) NOT NULL DEFAULT '',
	PRIMARY KEY (id_game)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE report_message_kinds (
	id_msg_kind int(10) unsigned NOT NULL auto_increment,
	message varchar(1024) NOT NULL DEFAULT '',
	hash binary(20) NOT NULL,
	PRIMARY KEY (id_msg_kind),
	KEY hash (hash)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE report_messages (
	id_msg int(10) unsigned NOT NULL auto_increment,
	id_msg_kind int(10) unsigned NOT NULL,
	id_game char(14) CHARACTER SET latin1 NOT NULL COMMENT 'Without hyphen.',
	formatted_message varchar(1024) NOT NULL DEFAULT '',
	formatted_hash binary(20) NOT NULL,
	PRIMARY KEY (id_msg),
	UNIQUE KEY `id_msg_kind-id_game-formatted_hash` (id_msg_kind, id_game, formatted_hash)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE report_message_versions (
	id_msg int(10) unsigned NOT NULL,
	id_version int(10) unsigned NOT NULL,
	first_report datetime NOT NULL,
	latest_report datetime NOT NULL,
	hits smallint(5) unsigned NOT NULL DEFAULT 1,
	PRIMARY KEY (id_msg, id_version),
	KEY `id_version-latest_report` (id_version, latest_report)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


ALTER TABLE report_messages
CHANGE COLUMN formatted_message formatted_message varchar(4096) NOT NULL DEFAULT '';