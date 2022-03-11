-- User Tabelle erzeugen
CREATE TABLE IF NOT EXISTS `user` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `phoneNumber` VARCHAR(20) NULL,
    `grade` INT NOT NULL,
    `misc` TEXT NULL,
    `passwordHash` VARCHAR(128) NULL,
    `authLevel` INT NOT NULL,
    `hasSignal` BOOLEAN NOT NULL DEFAULT FALSE,
    `hasWhatsapp` BOOLEAN NOT NULL DEFAULT FALSE,
    `hasDiscord` BOOLEAN NOT NULL DEFAULT FALSE,
    `discordUser` VARCHAR(32) NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updatedAt` TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE(email)
);

CREATE TABLE IF NOT EXISTS `subject` (
    `id` int NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`id`)
);

-- offer table
CREATE TABLE IF NOT EXISTS `offer` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `userId` INT NOT NULL,
    `subjectId` INT NOT NULL,
    `maxGrade` INT NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`userId`) REFERENCES user (id) ON DELETE CASCADE,
    FOREIGN KEY (`subjectId`) REFERENCES subject (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `subject` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    PRIMARY KEY (`id`)
);

INSERT INTO `subject` (`id`, `name`) VALUES
(1, 'Biologie'),
(2, 'Chemie'),
(3, 'Deutsch'),
(4, 'Englisch'),
(5, 'Erdkunde'),
(6, 'ev. Religion'),
(7, 'Französisch'),
(8, 'Geschichte'),
(9, 'Informatik'),
(10, 'kath. Religion'),
(11, 'Kunst'),
(12, 'Latein'),
(13, 'Mathematik'),
(14, 'Musik'),
(15, 'Pädagogik'),
(16, 'Philosophie'),
(17, 'Physik'),
(18, 'Politik/SoWi'),
(19, 'Spanisch'),
(187, 'Fortnite');

ALTER TABLE subject ORDER By name;

-- request table
CREATE TABLE IF NOT EXISTS `request` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `subjectId` INT NOT NULL,
    `grade` INT NOT NULL,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`subjectId`) REFERENCES subject (id) ON DELETE CASCADE
);

-- verification_codes table
CREATE TABLE IF NOT EXISTS `verificationToken` (
    `token` VARCHAR(64) NOT NULL,
    `userId` INT NOT NULL,
    PRIMARY KEY (`token`),
    FOREIGN KEY (`userId`) REFERENCES user (id) ON DELETE CASCADE
);

-- sessions table
CREATE TABLE IF NOT EXISTS `session` (
    `token` VARCHAR(64) NOT NULL,
    `userId` INT NOT NULL,
    `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`token`),
    FOREIGN KEY (`userId`) REFERENCES user (id) ON DELETE CASCADE
);

-- nice statistics for admin dashboard + anonym
CREATE TABLE IF NOT EXISTS `apiRequest` (
    id INT NOT NULL AUTO_INCREMENT,
    method VARCHAR(10) NOT NULL,
    authLevel INT NOT NULL DEFAULT 0,
    path VARCHAR(255) NOT NULL,
    time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(64) NOT NULL,
    PRIMARY KEY (id)
);
