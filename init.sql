-- User Tabelle erzeugen
CREATE TABLE IF NOT EXISTS `tutoring`.`user` (
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

-- offer table
CREATE TABLE IF NOT EXISTS `tutoring`.`offer` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `user_id` INT NOT NULL,
    `subject` VARCHAR(50) NOT NULL,
    `max_grade` INT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES user (id) ON DELETE CASCADE
);

-- request table
CREATE TABLE IF NOT EXISTS `tutoring`.`request` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `subject_id` INT NOT NULL,
    `grade` INT NOT NULL,
    PRIMARY KEY (`id`)
);

-- verification_codes table
CREATE TABLE IF NOT EXISTS `tutoring`.`verification_code` (
    `id` VARCHAR(64) NOT NULL,
    `user_id` INT NOT NULL,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`user_id`) REFERENCES user (id) ON DELETE CASCADE
);

-- sessions table
CREATE TABLE IF NOT EXISTS `tutoring`.`session` (
    `token` VARCHAR(64) NOT NULL,
    `user_id` INT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`token`),
    FOREIGN KEY (`user_id`) REFERENCES user (id) ON DELETE CASCADE
)