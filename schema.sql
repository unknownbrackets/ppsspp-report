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


CREATE TABLE gpus (
	id_gpu mediumint(8) unsigned NOT NULL auto_increment,
	short_desc varchar(96) NOT NULL DEFAULT '',
	long_desc varchar(16384) NOT NULL DEFAULT '',
	hash binary(20) NOT NULL,
	PRIMARY KEY (id_gpu),
	KEY hash (hash)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE cpus (
	id_cpu mediumint(8) unsigned NOT NULL auto_increment,
	summary varchar(1024) NOT NULL DEFAULT '',
	hash binary(20) NOT NULL,
	PRIMARY KEY (id_cpu),
	KEY hash (hash)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

CREATE TABLE platforms (
	id_platform mediumint(8) unsigned NOT NULL auto_increment,
	title varchar(32) CHARACTER SET latin1 NOT NULL,
	PRIMARY KEY (id_platform),
	UNIQUE KEY title (title)
) ENGINE=MyISAM DEFAULT CHARSET=utf8;


CREATE TABLE report_message_gpus (
	id_msg int(10) unsigned NOT NULL,
	id_gpu mediumint(8) unsigned NOT NULL,
	first_report datetime NOT NULL,
	latest_report datetime NOT NULL,
	hits smallint(5) unsigned NOT NULL DEFAULT 1,
	PRIMARY KEY (id_msg, id_gpu),
	KEY `id_gpu-latest_report` (id_gpu, latest_report)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE report_message_cpus (
	id_msg int(10) unsigned NOT NULL,
	id_cpu mediumint(8) unsigned NOT NULL,
	first_report datetime NOT NULL,
	latest_report datetime NOT NULL,
	hits smallint(5) unsigned NOT NULL DEFAULT 1,
	PRIMARY KEY (id_msg, id_cpu),
	KEY `id_cpu-latest_report` (id_cpu, latest_report)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE report_message_platforms (
	id_msg int(10) unsigned NOT NULL,
	id_platform mediumint(8) unsigned NOT NULL,
	first_report datetime NOT NULL,
	latest_report datetime NOT NULL,
	hits smallint(5) unsigned NOT NULL DEFAULT 1,
	PRIMARY KEY (id_msg, id_platform),
	KEY `id_platform-latest_report` (id_platform, latest_report)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;


ALTER TABLE report_messages
ADD COLUMN status enum('new', 'resolved', 'reoccurring') NOT NULL DEFAULT 'new',
ADD COLUMN resolved_version_value int(10) unsigned NOT NULL DEFAULT 0,
ADD INDEX status (status);


ALTER TABLE games
CHANGE COLUMN id_game id_game char(18) CHARACTER SET latin1 NOT NULL COMMENT 'Without hyphen.';

ALTER TABLE report_messages
CHANGE COLUMN id_game id_game char(18) CHARACTER SET latin1 NOT NULL COMMENT 'Without hyphen.';

ALTER TABLE versions
ADD INDEX `title-id_version` (title, id_version);


delimiter //
CREATE PROCEDURE resolve_message_kind (
	a_id_msg_kind int(10) unsigned,
	a_version_value int(10) unsigned
)
BEGIN
	IF a_version_value = 0 THEN
		SET a_version_value = (
			SELECT MAX(value)
			FROM versions
		);
	END IF;

	UPDATE report_messages
	SET status = 'resolved',
		resolved_version_value = a_version_value
	WHERE status IN ('new', 'reoccurring')
		AND (resolved_version_value <= a_version_value OR status = 'new')
		AND id_msg_kind = a_id_msg_kind;
END//

CREATE PROCEDURE resolve_message_id (
	a_id_msg int(10) unsigned,
	a_version_value int(10) unsigned
)
BEGIN
	IF a_version_value = 0 THEN
		SET a_version_value = (
			SELECT MAX(value)
			FROM versions
		);
	END IF;

	UPDATE report_messages
	SET status = 'resolved',
		resolved_version_value = a_version_value
	WHERE status IN ('new', 'reoccurring')
		AND (resolved_version_value <= a_version_value OR status = 'new')
		AND id_msg = a_id_msg;
END//

CREATE PROCEDURE resolve_message_formatted (
	a_id_msg_kind int(10) unsigned,
	a_formatted_message varchar(1024),
	a_version_value int(10) unsigned
)
BEGIN
	IF a_version_value = 0 THEN
		SET a_version_value = (
			SELECT MAX(value)
			FROM versions
		);
	END IF;

	UPDATE report_messages
	SET status = 'resolved',
		resolved_version_value = a_version_value
	WHERE status IN ('new', 'reoccurring')
		AND (resolved_version_value <= a_version_value OR status = 'new')
		AND id_msg_kind = a_id_msg_kind
		AND formatted_hash = UNHEX(SHA1(a_formatted_message))
		AND formatted_message = a_formatted_message;
END//

CREATE FUNCTION fetch_cpu_ (
	a_summary varchar(1024),
	a_hash binary(20)
) RETURNS mediumint(8) unsigned READS SQL DATA
BEGIN
	RETURN (
		SELECT id_cpu
		FROM cpus
		WHERE summary = a_summary
			AND hash = a_hash
		LIMIT 1
	);
END//

CREATE PROCEDURE create_cpu (
	a_summary varchar(1024)
)
BEGIN
	DECLARE v_id_cpu mediumint(8) unsigned;
	DECLARE v_hash binary(20) DEFAULT UNHEX(SHA1(a_summary));

	SET v_id_cpu = fetch_cpu_(a_summary, v_hash);

	IF v_id_cpu IS NULL THEN
		INSERT IGNORE INTO cpus
			(summary, hash)
		VALUES (a_summary, v_hash);

		-- Re-select in case someone else inserted.
		SET v_id_cpu = fetch_cpu_(a_summary, v_hash);
	END IF;

	SELECT v_id_cpu;
END//

CREATE FUNCTION fetch_platform_ (
	a_title varchar(32)
) RETURNS mediumint(8) unsigned READS SQL DATA
BEGIN
	RETURN (
		SELECT id_platform
		FROM platforms
		WHERE title = a_title
		LIMIT 1
	);
END//

CREATE PROCEDURE create_platform (
	a_title varchar(32) CHARACTER SET latin1
)
BEGIN
	DECLARE v_id_platform mediumint(8) unsigned;

	SET v_id_platform = fetch_platform_(a_title);
	IF v_id_platform IS NULL THEN
		INSERT IGNORE INTO platforms
			(title)
		VALUES (a_title);

		-- Re-select in case someone else inserted.
		SET v_id_platform = fetch_platform_(a_title);
	END IF;

	SELECT v_id_platform;
END//

CREATE FUNCTION fetch_gpu_ (
	a_short_desc varchar(96),
	a_long_desc varchar(16384),
	a_hash binary(20)
) RETURNS mediumint(8) unsigned READS SQL DATA
BEGIN
	RETURN (
		SELECT id_gpu
		FROM gpus
		WHERE short_desc = a_short_desc
			AND long_desc = a_long_desc
			AND hash = a_hash
		LIMIT 1
	);
END//

CREATE PROCEDURE create_gpu (
	a_short_desc varchar(96),
	a_long_desc varchar(16384)
)
BEGIN
	DECLARE v_id_gpu mediumint(8) unsigned;
	DECLARE v_hash binary(20) DEFAULT UNHEX(SHA1(CONCAT(a_short_desc, a_long_desc)));

	SET v_id_gpu = fetch_gpu_(a_short_desc, a_long_desc, v_hash);
	IF v_id_gpu IS NULL THEN
		INSERT IGNORE INTO gpus
			(short_desc, long_desc, hash)
		VALUES (a_short_desc, a_long_desc, v_hash);

		-- Re-select in case someone else inserted.
		SET v_id_gpu = fetch_gpu_(a_short_desc, a_long_desc, v_hash);
	END IF;

	SELECT v_id_gpu;
END//

CREATE PROCEDURE create_report_message (
	a_id_msg_kind int(10) unsigned,
	a_id_game char(18) CHARACTER SET latin1,
	a_formatted_message varchar(1024),
	a_id_version int(10) unsigned
)
BEGIN
	DECLARE v_id_msg int(10) unsigned;
	DECLARE v_status enum('new', 'resolved', 'reoccurring');
	DECLARE v_formatted_hash binary(20) DEFAULT UNHEX(SHA1(a_formatted_message));

	DECLARE v_version_value int(10) unsigned;
	DECLARE v_resolved_value int(10) unsigned;

	SELECT id_msg, status
	INTO v_id_msg, v_status
	FROM report_messages
	WHERE id_msg_kind = a_id_msg_kind
		AND id_game = a_id_game
		AND formatted_hash = v_formatted_hash
		AND formatted_message = a_formatted_message
	LIMIT 1;

	IF v_status = 'resolved' THEN
		-- Oh well, guess it's happening again... unless this is an older version.
		SET v_version_value = (
			SELECT value
			FROM versions
			WHERE id_version = a_id_version
			LIMIT 1
		);
		SET v_resolved_value = (
			SELECT resolved_version_value
			FROM report_messages
			WHERE id_msg = v_id_msg
			LIMIT 1
		);

		IF v_version_value >= v_resolved_value THEN
			UPDATE report_messages
			SET status = 'reoccurring'
			WHERE id_msg = v_id_msg
				AND resolved_version_value < v_version_value
			LIMIT 1;
		END IF;
	ELSEIF v_id_msg IS NULL THEN
		INSERT IGNORE INTO report_messages
			(id_msg_kind, id_game, formatted_hash, formatted_message)
		VALUES (a_id_msg_kind, a_id_game, v_formatted_hash, a_formatted_message);

		SET v_id_msg = (
			SELECT id_msg
			FROM report_messages
			WHERE id_msg_kind = a_id_msg_kind
				AND id_game = a_id_game
				AND formatted_hash = v_formatted_hash
				AND formatted_message = a_formatted_message
			LIMIT 1
		);
	END IF;

	SELECT v_id_msg;
END//

CREATE FUNCTION fetch_report_message_kind_ (
	a_message varchar(1024),
	a_hash binary(20)
) RETURNS int(10) unsigned READS SQL DATA
BEGIN
	RETURN (
		SELECT id_msg_kind
		FROM report_message_kinds
		WHERE hash = a_hash
			AND message = a_message
		ORDER BY id_msg_kind ASC
		LIMIT 1
	);
END//

CREATE PROCEDURE create_report_message_kind (
	a_message varchar(1024)
)
BEGIN
	DECLARE v_id_msg_kind int(10) unsigned;
	DECLARE v_hash binary(20) DEFAULT UNHEX(SHA1(a_message));

	SET v_id_msg_kind = fetch_report_message_kind_(a_message, v_hash);
	IF v_id_msg_kind IS NULL THEN
		-- Unfortunately, this could create duplicates.
		-- We'll always get the same (lowest id) anyway, though.
		-- Can just clean them up later, rather than taking a hit for a transaction.
		INSERT IGNORE INTO report_message_kinds
			(message, hash)
		VALUES (a_message, v_hash);

		-- Re-select in case someone else inserted.
		SET v_id_msg_kind = fetch_report_message_kind_(a_message, v_hash);
	END IF;

	SELECT v_id_msg_kind;
END//

CREATE FUNCTION fetch_game_exists_ (
	a_id_game char(18) CHARACTER SET latin1
) RETURNS tinyint(1) READS SQL DATA
BEGIN
	RETURN EXISTS (
		SELECT id_game
		FROM games
		WHERE id_game = a_id_game
		LIMIT 1
	);
END//

CREATE PROCEDURE create_game (
	a_id_game char(18) CHARACTER SET latin1,
	a_title varchar(255)
)
BEGIN
	DECLARE v_exists tinyint(1);
	SET v_exists = fetch_game_exists_(a_id_game);
	IF v_exists = 0 THEN
		INSERT IGNORE INTO games
			(id_game, title)
		VALUES (a_id_game, a_title);
	END IF;

	SELECT a_id_game;
END//

CREATE FUNCTION fetch_version_ (
	a_title varchar(32)
) RETURNS int(10) unsigned READS SQL DATA
BEGIN
	RETURN (
		SELECT id_version
		FROM versions
		WHERE title = a_title
		LIMIT 1
	);
END//

CREATE PROCEDURE create_version (
	a_title varchar(32),
	a_value int(10) unsigned
)
BEGIN
	DECLARE v_id_version int(10) unsigned;

	SET v_id_version = fetch_version_(a_title);
	IF v_id_version IS NULL THEN
		INSERT IGNORE INTO versions
			(title, value)
		VALUES (a_title, a_value);

		-- Re-select in case someone else inserted.
		SET v_id_version = fetch_version_(a_title);
	END IF;

	SELECT v_id_version;
END//

delimiter ;


ALTER TABLE report_messages
ADD INDEX id_game (id_game);


delimiter //

CREATE PROCEDURE report_message_hit (
	a_id_msg int(10) unsigned,
	a_id_version int(10) unsigned,
	a_id_gpu mediumint(8) unsigned,
	a_id_cpu mediumint(8) unsigned,
	a_id_platform mediumint(8) unsigned
)
BEGIN
	INSERT INTO report_message_versions
		(id_msg, id_version, first_report, latest_report)
	VALUES (a_id_msg, a_id_version, NOW(), NOW())
		ON DUPLICATE KEY UPDATE
			latest_report = NOW(),
			hits = hits + 1;

	INSERT INTO report_message_gpus
		(id_msg, id_gpu, first_report, latest_report)
	VALUES (a_id_msg, a_id_gpu, NOW(), NOW())
		ON DUPLICATE KEY UPDATE
			latest_report = NOW(),
			hits = hits + 1;

	INSERT INTO report_message_cpus
		(id_msg, id_cpu, first_report, latest_report)
	VALUES (a_id_msg, a_id_cpu, NOW(), NOW())
		ON DUPLICATE KEY UPDATE
			latest_report = NOW(),
			hits = hits + 1;

	INSERT INTO report_message_platforms
		(id_msg, id_platform, first_report, latest_report)
	VALUES (a_id_msg, a_id_platform, NOW(), NOW())
		ON DUPLICATE KEY UPDATE
			latest_report = NOW(),
			hits = hits + 1;
END//

delimiter ;


ALTER TABLE versions
ADD INDEX `value-id_version` (value, id_version);

delimiter //
CREATE PROCEDURE resolve_message_kind_before (
	a_id_msg_kind int(10) unsigned,
	a_version_value int(10) unsigned
)
BEGIN
	UPDATE report_messages
	SET status = 'resolved',
		resolved_version_value = a_version_value
	WHERE status IN ('new', 'reoccurring')
		AND (resolved_version_value <= a_version_value OR status = 'new')
		AND id_msg_kind = a_id_msg_kind
		AND id_msg NOT IN (
				SELECT id_msg
				FROM report_message_versions
					NATURAL JOIN versions
				WHERE value > a_version_value
			);
END//

delimiter ;


CREATE TABLE settings (
	min_version_value int(10) unsigned NOT NULL DEFAULT 0
) ENGINE=MyISAM DEFAULT CHARSET=utf8;

INSERT INTO settings
	(min_version_value)
VALUES (0);
