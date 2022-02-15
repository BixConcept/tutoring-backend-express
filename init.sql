-- User Tabelle erzeugen
CREATE TABLE IF NOT EXISTS `nachhilfe`.`user` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `phone_number` VARCHAR(20) NULL,
    `grade` INT NOT NULL,
    `misc` TEXT NULL,
    `password_hash` VARCHAR(128) NULL,
    `auth` INT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    `last_activity` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE(email)
);

CREATE TABLE IF NOT EXISTS `nachhilfe`.`subject` (
    `id` int NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`id`)
);

-- offer table
CREATE TABLE IF NOT EXISTS `nachhilfe`.`offer` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `subject_id` INT NOT NULL,
    `max_grade` INT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES user (id) ON DELETE CASCADE,
    FOREIGN KEY (`subject_id`) REFERENCES subject (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `nachhilfe`.`subject` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`id`)
);

-- request table
CREATE TABLE IF NOT EXISTS `nachhilfe`.`request` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `subject_id` INT NOT NULL,
    `grade` INT NOT NULL,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`subject_id`) REFERENCES subject (id) ON DELETE CASCADE
);

-- verification_codes table
CREATE TABLE IF NOT EXISTS `nachhilfe`.`verification_token` (
    `token` VARCHAR(64) NOT NULL,
    `user_id` INT NOT NULL,
    PRIMARY KEY (`token`),
    FOREIGN KEY (`user_id`) REFERENCES user (id) ON DELETE CASCADE
);

-- sessions table
CREATE TABLE IF NOT EXISTS `nachhilfe`.`session` (
    `token` VARCHAR(64) NOT NULL,
    `user_id` INT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`token`),
    FOREIGN KEY (`user_id`) REFERENCES user (id) ON DELETE CASCADE
)

