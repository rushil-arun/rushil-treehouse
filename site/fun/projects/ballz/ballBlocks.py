import asyncio
import pygame
import random
from math import floor, sqrt

width = 402
height = 700
pygame.init()
screen = pygame.display.set_mode((width, height))
black = (0, 0, 0)
white = (255, 255, 255)
lime = (102, 255, 102)
yellow = (255, 255, 51)
orange = (255, 128, 0)
blue = (0, 0, 255)
purple = (180, 0, 180)
red = (255, 0, 0)
cyan = (153, 255, 255)
gray = (160, 160, 160)
green = (0, 255, 0)
pink = (255, 141, 244)
lightBlack = (65, 65, 65)
indigo = (81, 0, 188)
tileCount = 6 # amount of tiles in a row
tileGap = 0
currentVelRate = 0.5
hits = 0
blockSize = (width - (tileGap * (tileCount + 1))) // tileCount
blockRandom = random.randint(0, tileCount - 1)
squaresList = []
ballsList = []
powerUpsList = []
trianglesList = []
level = 0
turn = 0
numFont = pygame.font.SysFont("comicsans", 30)
startingBlockPos = blockRandom * (width // tileCount), tileGap#((blockRandom * blockSize) + (tileGap * (blockRandom + 1)), tileGap)


class Ball:
    def __init__(self, x, y, xVel, yVel, velRate):
        self.x = x
        self.y = y
        self.xVel = xVel
        self.yVel = yVel
        self.velRate = velRate
        self.xDist = 0
        self.yDist = 0
        self.vel = 0
        self.ballSize = 10
        self.drawLine = True
        self.isMoving = False
        self.isCollide = None
        self.isCollideTri = None
        

    def draw(self):
        pygame.draw.circle(screen, yellow, (floor(self.x), floor(self.y)), self.ballSize)

    def angleLine(self, xPos, yPos):
        if self.drawLine == True:
            pygame.draw.line(screen, white, (floor(self.x), floor(self.y)), (xPos, yPos))

    def setVelocity(self, xPos, yPos):
        self.xDist = self.x - xPos
        self.yDist = self.y - yPos
        self.vel = self.yDist / self.xDist
        if abs(self.vel) >= 1:
            self.yVel = -self.velRate
            self.xVel = self.velRate / -self.vel
        else:
            if (self.vel > 0):
                self.xVel = -self.velRate
                self.yVel = -self.vel / (1 / self.velRate)
            else:
                self.xVel = self.velRate
                self.yVel = self.vel / (1 / self.velRate)

    def move(self):    
        self.x += self.xVel
        self.y += self.yVel
        self.changeAngle()
        for square in squaresList:
            self.xVel, self.yVel = square.collide(self.x, self.y, self.ballSize, self.xVel, self.yVel)
        for pu in powerUpsList:
            self.isCollide = pu.collision(self.x, self.y, self.ballSize)
            if self.isCollide == True:
                break
            #pu.remove()
        for tri in trianglesList:
            self.isCollideTri = tri.collision(self.x, self.y)
            if self.isCollideTri == True:
                break
        self.changePos()
        self.draw()

    def changeAngle(self):
        if self.x < self.ballSize or self.x > width - self.ballSize:
            self.xVel = -self.xVel
            self.yVel = self.yVel
        if self.y < self.ballSize:
            self.xVel = self.xVel
            self.yVel = -self.yVel

    def changePos(self):
        if self.y > height: 
            self.isMoving = False
            self.x = width // 2
            self.y = height - 30
        
            




class Block:
    def __init__(self, x, y, tileSize, lifePoints):
        self.x = x
        self.y = y
        self.tileSize = tileSize
        self.lifePoints = lifePoints
        self.testX = None
        self.testY = None
        self.color = None
        

    def draw(self):
        if self.lifePoints > 0:
            self.changeColor()
            pygame.draw.rect(screen, self.color, (self.x, self.y, self.tileSize, self.tileSize))
            pygame.draw.line(screen, black, (self.x, self.y), (self.x, self.y + self.tileSize), 2)
            pygame.draw.line(screen, black, (self.x, self.y), (self.x + self.tileSize, self.y), 2)
            pygame.draw.line(screen, black, (self.x + self.tileSize, self.y), (self.x + self.tileSize, self.y + self.tileSize), 2)
            pygame.draw.line(screen, black, (self.x, self.y + self.tileSize), (self.x + self.tileSize, self.y + self.tileSize), 2)
            text = numFont.render(str(self.lifePoints), 1, black)
            rect = text.get_rect(center=(self.x + (self.tileSize // 2), self.y + (self.tileSize // 2)))
            screen.blit(text, rect)

    def changeColor(self):
        if self.lifePoints <= 7:
            self.color = red
        elif self.lifePoints <= 16:
            self.color = lime
        elif self.lifePoints <= 29:
            self.color = blue
        elif self.lifePoints <= 45:
            self.color = yellow
        elif self.lifePoints <= 65:
            self.color = green
        elif self.lifePoints <= 87:
            self.color = cyan
        elif self.lifePoints <= 110:
            self.color = pink
        elif self.lifePoints <= 140:
            self.color = purple
        else:
            self.color = orange


    def remove(self):
        if self.lifePoints <= 0:
            squaresList.remove(self)
        

    def collide(self, circleX, circleY, radius, velX, velY):
        global hits
        self.testX = circleX
        self.testY = circleY

        if circleX < self.x:
            self.testX = self.x
        elif circleX > self.x + self.tileSize:
            self.testX = self.x + self.tileSize
        if circleY < self.y:
            self.testY = self.y
        elif circleY > self.y + self.tileSize:
            self.testY = self.y + self.tileSize

        distX = circleX - self.testX
        distY = circleY - self.testY
        
        dist = sqrt((distX ** 2) + (distY ** 2))
        if dist <= radius:
            if (self.testX == circleX):
                hits += 1
                self.lifePoints -= 1
                velX = velX
                velY = -velY
                self.remove()
            elif (self.testY == circleY):
                hits += 1
                self.lifePoints -= 1
                velX = -velX
                velY = velY
                self.remove()
            else:
                hits += 1
                self.lifePoints -= 1
                velX = -velX
                velY = -velY
                self.remove()
        
        return velX, velY

    def moveDown(self):
        self.y += self.tileSize + tileGap


class Powerup:
    blockRandom = random.randint(0, tileCount - 1)

    def __init__(self):
        self.x = (blockRandom * (width // tileCount)) + (blockSize // 2)
        self.y = tileGap + (blockSize // 2)
        self.radius = 15
        self.health = 1
        self.isOverlap = None
        

    def draw(self):
        if self.health != 0:
            pygame.draw.circle(screen, white, (self.x, self.y), self.radius, 1)
            pygame.draw.circle(screen, white, (self.x, self.y), self.radius // 2, 1)

    def changePos(self):
        self.isOverlap = checkInSquares(self.x - (blockSize // 2), self.y - (blockSize // 2))
        while not self.isOverlap:
            blockRandom = random.randint(0, tileCount - 1)
            self.x = (blockRandom * (width // tileCount)) + (blockSize // 2)
            self.y = tileGap + (blockSize // 2)
            self.isOverlap = checkInSquares(self.x - (blockSize // 2), self.y - (blockSize // 2)) 
            

    def collision(self, x, y, radius):
        distX = self.x - x
        distY = self.y - y
        realDist = sqrt((distX ** 2) + (distY ** 2))

        if realDist <= radius + self.radius:
            self.health = 0
            self.remove()
            return True
        
        return False

    def remove(self):
        if self.health == 0:
            powerUpsList.remove(self)

    def moveDown(self):
        self.y += blockSize

class Triangle:
    blockRandom = random.randint(0, tileCount - 1)
    def __init__(self):
        self.halfSize = 15
        self.x1 = (blockRandom * (width // tileCount)) + (blockSize // 2)
        self.y1 = tileGap + (blockSize // 2) - self.halfSize
        self.x2 = (blockRandom * (width // tileCount)) + (blockSize // 2) - self.halfSize
        self.y2 = tileGap + (blockSize // 2) + self.halfSize
        self.x3 = (blockRandom * (width // tileCount)) + (blockSize // 2) + self.halfSize
        self.y3 = tileGap + (blockSize // 2) + self.halfSize
        self.isOverlap = None
        self.isOverlapBall = None
        self.health = 1
        self.originalArea = None

    def draw(self):
        if self.health != 0:
            pygame.draw.polygon(screen, indigo, [(self.x1, self.y1), (self.x2, self.y2), (self.x3, self.y3)])

    def changePos(self):
        self.isOverlap = checkInSquares(self.x1 - (blockSize // 2), self.y1 + self.halfSize - (blockSize // 2))
        self.isOverlapBall = checkInPowerup(self.x1, self.y1 + self.halfSize)
        
        while self.isOverlap == False or (self.isOverlapBall == False):
            blockRandom = random.randint(0, tileCount - 1)
            self.x1 = (blockRandom * (width // tileCount)) + (blockSize // 2)
            self.y1 = tileGap + (blockSize // 2) - self.halfSize
            self.x2 = (blockRandom * (width // tileCount)) + (blockSize // 2) - self.halfSize
            self.y2 = tileGap + (blockSize // 2) + self.halfSize
            self.x3 = (blockRandom * (width // tileCount)) + (blockSize // 2) + self.halfSize
            self.y3 = tileGap + (blockSize // 2) + self.halfSize
            self.isOverlap = checkInSquares(self.x1 - (blockSize // 2), self.y1 + self.halfSize - (blockSize // 2))
            self.isOverlapBall = checkInPowerup(self.x1, self.y1 + self.halfSize)

    def collision(self, x, y):
        if (x >= self.x2 and x <= self.x3 and y >= self.y1 and y <= self.y3):
            self.health = 0
            self.remove()
            return True
        
        return False

    def remove(self):
        if self.health == 0:
            trianglesList.remove(self)

    def moveDown(self):
        self.y1 += blockSize
        self.y2 += blockSize
        self.y3 += blockSize


def checkBallsList():
    for ball in ballsList:
        if ball.isMoving == True:
            return True
    
    return False

def checkInSquares(x, y):
    for square in squaresList:
        if square.x == x and square.y == y:
            return False
    
    return True

def checkInPowerup(x, y):
    for pp in powerUpsList:
        if pp.x == x and pp.y == y:
            return False

    return True
def squares():
    global blockRandom, startingBlockPos
    num = random.randint(2, tileCount - 3)
    for i in range(num):
        blockRandom = random.randint(0, tileCount - 1)
        startingBlockPos = blockRandom * (width // tileCount), tileGap
        newPos = (startingBlockPos[0], startingBlockPos[1])
        isInList = checkInSquares(newPos[0], newPos[1])
        while not isInList:
            blockRandom = random.randint(0, tileCount - 1)
            startingBlockPos = blockRandom * (width // tileCount), tileGap
            newPos = (startingBlockPos[0], startingBlockPos[1])
            isInList = checkInSquares(newPos[0], newPos[1])
        
        squaresList.append(Block(newPos[0], newPos[1], blockSize, (random.randint(floor((2 * level) + 1), floor(((4 * level) + 1))))))    
  
def powerups(powerUpsList):
    rand = random.randint(0, 2)
    if rand == 0:
        powerUp = Powerup()
        powerUp.changePos()
        powerUpsList.append(powerUp)
    return powerUpsList

def triangles(trianglesList):
    rand = random.randint(0, 3)
    if rand == 0:
        triangle = Triangle()
        triangle.changePos()
        trianglesList.append(triangle)

    return trianglesList

def increaseBalls():
    for ball in ballsList:
        if ball.isCollide == True:
            return True

    return False

def increaseTileCounts():
    for ball in ballsList:
        if ball.isCollideTri == True:
            return True
    
    return False

def increaseTiles():
    for square in squaresList:
        square.lifePoints = square.lifePoints // 2

def setCaption(level):
    pygame.display.set_caption(("Levels: " + str(level + 1) + " | Balls: " + str(len(ballsList))))

async def game():
    global level, turn, startingBlockPos, hits, powerUpsList, currentVelRate, trianglesList
    gameOver = False
    counter = 75
    ball = Ball(width // 2, height - 30, 0, 0, currentVelRate)
    gameTurn = 0
    counterStarter = 75
    isMove = False
    ballsList.append(ball)
    squares()
    powerUpsList = powerups(powerUpsList)
    trianglesList = triangles(trianglesList)
    while not gameOver:
        pos = pygame.mouse.get_pos()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                gameOver = True
            if event.type == pygame.MOUSEBUTTONUP:
                pos = pygame.mouse.get_pos()
                if pos[1] >= ball.y - 1:
                    pass
                else:
                    turn += 1
                    if not checkBallsList():    
                        for ball in ballsList:                 
                            for square in squaresList:
                                ball.drawLine = False   
                                ball.setVelocity(pos[0], pos[1])
                                ball.isMoving = True
  
        screen.fill(lightBlack)
        setCaption(level)
        for ball in ballsList:
            ball.draw()
            ball.isCollide = False
            ball.isCollideTri = False
        for square in squaresList:
            if square.y > height - square.tileSize - tileGap - 40:
                gameOver = True
            square.draw()
        for pp in powerUpsList: 
            pp.draw()
        for tri in trianglesList:
            tri.draw()
    
        if pos[1] < ball.y - 1 and not checkBallsList():
            ball.angleLine(pos[0], pos[1])

        for ball in ballsList:
            if checkBallsList():
                isMove = True
                if ball.isMoving == True:
                    if floor((counter / counterStarter)) >= ballsList.index(ball):
                        ball.move()
                        
                                  
                    
            
            elif not checkBallsList() and turn > 0:
                for square in squaresList:
                    square.moveDown()
                for pp in powerUpsList:
                    pp.moveDown()
                for tri in trianglesList:
                    tri.moveDown()
                    
                isMove = False
                turn = 0
                level += 1
                counter = 100
                ballsList.append(Ball(width // 2, height - 30, 0, 0, currentVelRate))

                squares()
                powerUpsList = powerups(powerUpsList)
                trianglesList = triangles(trianglesList)
                currentVelRate += 0.2
                for ball in ballsList:
                    ball.velRate = currentVelRate
                #counterStarter -= 3
                break

        if isMove == True:
            counter += 1

        appendNewBall = increaseBalls()
        changeTileCount = increaseTileCounts()
        if appendNewBall == True:
            ballsList.append(Ball(width // 2, height - 30, 0, 0, currentVelRate))
            appendNewBall = False
        
        if changeTileCount == True:
            increaseTiles()
            changeTileCount = False

        pygame.display.update()
        await asyncio.sleep(0)  # in the browser, let the page draw and take input

    pygame.quit()

if __name__ == "__main__":
    asyncio.run(game())
