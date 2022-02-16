-- User Tabelle erzeugen
CREATE TABLE IF NOT EXISTS `tutoring`.`user` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `phoneNumber` VARCHAR(20) NULL,
    `grade` INT NOT NULL,
    `misc` TEXT NULL,
    `passwordHash` VARCHAR(128) NULL,
    `auth` INT NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE(email)
);

CREATE TABLE IF NOT EXISTS `tutoring`.`subject` (
    `id` int NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`id`)
);

-- offer table
CREATE TABLE IF NOT EXISTS `tutoring`.`offer` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `userId` INT NOT NULL,
    `subjectId` INT NOT NULL,
    `maxGrade` INT NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`userId`) REFERENCES user (id) ON DELETE CASCADE,
    FOREIGN KEY (`subjectId`) REFERENCES subject (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `tutoring`.`subject` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`id`)
);

INSERT INTO `subject` (`id`, `name`) VALUES
(1, 'Biologie'),
(2, 'Chemie'),
(3, 'Deutsch'),
(4, 'Deutsch'),
(5, 'Englisch'),
(6, 'Englisch'),
(7, 'Erdkunde'),
(8, 'ev. Religion'),
(9, 'Französisch'),
(10, 'Geschichte'),
(11, 'Informatik'),
(12, 'kath. Reli'),
(13, 'Kunst'),
(14, 'Latein'),
(15, 'Mathematik'),
(16, 'Mathematik'),
(17, 'Musik'),
(18, 'Pädagogik'),
(19, 'Philosophie'),
(20, 'Physik'),
(21, 'Physik'),
(22, 'Politik/SoWi'),
(23, 'Spanisch'),
(187, 'Fortnite');



ALTER TABLE subject ORDER By name;

-- request table
CREATE TABLE IF NOT EXISTS `tutoring`.`request` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `subjectId` INT NOT NULL,
    `grade` INT NOT NULL,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`subject_id`) REFERENCES subject (id) ON DELETE CASCADE
);

-- verification_codes table
CREATE TABLE IF NOT EXISTS `tutoring`.`verification_token` (
    `token` VARCHAR(64) NOT NULL,
    `userId` INT NOT NULL,
    PRIMARY KEY (`token`),
    FOREIGN KEY (`user_id`) REFERENCES user (id) ON DELETE CASCADE
);

-- sessions table
CREATE TABLE IF NOT EXISTS `tutoring`.`session` (
    `token` VARCHAR(64) NOT NULL,
    `userId` INT NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`token`),
    FOREIGN KEY (`userId`) REFERENCES user (id) ON DELETE CASCADE
)

