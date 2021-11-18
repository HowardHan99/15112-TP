from cmu_112_graphics import *
from tkinter import *
from tkinter import messagebox
import pickle
#There are some help function that may be used.
def distance(cx,cy,dx,dy):
    return ((cx-dx)**2 + (cy-dy)**2)**0.5

def make2dList(rows,cols):
    return [[]*cols for i in range(rows)]

#https://blog.csdn.net/t60339/article/details/82842728 
#A single question and answer box
def SingleinputBox(title, message):
    def return_callback(event):
        print('quit...')
        root.quit()
    def close_callback():
        messagebox.showinfo('message', 'no click...')
    root = Tk(className=title)
    root.wm_attributes('-topmost', 1)
    screenwidth, screenheight = root.maxsize()
    width = 300
    height = 100
    size = '%dx%d+%d+%d' % (width, height, (screenwidth - width)/2, (screenheight - height)/2)
    root.geometry(size)
    root.resizable(0, 0)
    Lable = Label(root, height=2)
    Lable['text'] = message
    Lable.pack()
    entry = Entry(root)
    entry.bind('<Return>', return_callback)
    entry.pack()
    entry.focus_set()
    root.protocol("WM_DELETE_WINDOW", close_callback)
    root.mainloop()
    str = entry.get()
    root.destroy()
    return str

on_hit = False
def InputInformation():
    window = Tk()
    window.title('Sticky Notes')
    window.geometry('500x300')
    var = StringVar() 
    var.set('Please Fill the next information')
    note = Label(window, textvariable=var, font=('Arial', 12), width=30, height=2)
    note.pack() 
    
    def hit_me():
        global on_hit
        if on_hit == False:
            on_hit = True
            var.set('Finished')
        else:
            on_hit = False
            var.set('Please Fill the next information')

    b = Button(window, text='Finish', font=('Arial', 12), width=10, height=1, command=hit_me)
    Label(window, text='Name',show=None, font=('Arial', 14)).place(x=30, y=50)
    Label(window, text='Start Time',show=None, font=('Arial', 14)).place(x=30, y=80)
    Label(window, text='Duration',show=None, font=('Arial', 14)).place(x=30, y=110)
    Label(window, text='Category',show=None, font=('Arial', 14)).place(x=30, y=140)
    Label(window, text='Importance',show=None, font=('Arial', 14)).place(x=30, y=170)
    b.place(x=360, y=200)
    var_name = StringVar()
    e = Entry(window,textvariable=var_name)
    e.place(x=120, y=55)
    Name= var_name.get()
    var_time = StringVar()
    e1 = Entry(window,textvariable=var_time, show = None)
    e1.place(x=120, y=85)
    Starttime = var_time.get()
    var_long = StringVar()
    e2 = Entry(window,textvariable=var_long, show = None).place(x=120, y=115)
    Duration =var_long.get()
    var_Category = StringVar()
    e3 = Entry(window,textvariable=var_Category, show = None).place(x=120, y=145)
    Category = var_Category.get()
    var_importance = StringVar() 
    e4 = Entry(window, textvariable=var_importance,show = None).place(x=120, y=175)
    Importance = var_importance.get()
    print(Name,Starttime,Duration,Category,Importance)
    return(Name,Starttime,Duration,Category,Importance)

# Create a card class which can add the things you want to do
# The time needed and the start time
class Card (object):
#####Questions
# Is it appropriate to set so much value at the start 
 def __init__(self,important,name,start_time,duration,category,
    cx,cy,width, height) :
     self.important = important
     self.name = name
     self.start_time = start_time
     self.duration = duration
     self.category = category
     self.cx = cx
     self.cy  = cy
     self.width = width
     self.height = height

#Event is basically very simlar to Card, but it does not have the drawing attribute
#However, it does has some other attributes like progress, select.
class Event (object):
    def __init__(self,important,name,start_time,duration,category,
    progress,select) :
        self.important = important
        self.name = name
        self.start_time = start_time
        self.duration = duration
        self.category = category
        self.progress = progress
        self.select = select

class Timesheet(object):
    def __init__(self,interval,width,height):
        self.interval = interval
        self.width = width
        self.height = height
        self.list = make2dList(width,height)

class Button_self(object):
    def __init__(self, cx,cy,r,action):
        self.cx = cx
        self.cy = cy
        self.r = r
        self.action = action

AddCx = 700
AddCy = 60

ButtonR= 30

DeleteCX = 700
DeleteCy = 150
Weeksheet = Timesheet('2h',7,6)
AddCard = Button_self(AddCx, AddCy, ButtonR, 'add')
DeleteCard = Button_self(DeleteCX,DeleteCy, ButtonR, 'delete')
progress = ['Ongoing','Finish']

Date = ['Sun','Mon','Tues','Wed','Thurs','Fri','Sat']
# define time schope
def Create():
    time = []
    for i in range(0,24,2):
        time.append(i)
    return time
time = Create()
Important = ['high','medium','low']

def appStarted(app):
    app.button = []
    app.card = []
    app.timesheet = []
    app.event = [testevent1,testevent2,testevent3]
    app.time = 11
    app.grid = Weeksheet
    app.margin =10
    app.event_location = {}
    addbutton(app)

def addbutton(app):
    app.button.append(AddCard)
    app.button.append(DeleteCard)
   
def addCard(app):
#####Questions
# How to make it a multiple input box
# Is it any other way to input something, ex choose
# How to convet time
    # important = input('Enter your name:')
    # name = input('Enter your name:')
    # start_time = input('Enter your name:')
    # duration = input('Enter your name:')
    # category = input('Enter your name:')
    InputInformation()
    count = len(app.card)
    important = 'high'
    name = 'TP0'
    start_time = 'Sat'
    duration = 1
    category = 'study'
    cx = app.width-220
    cy = 50
    width = 80
    height = 90
    newCard = Card(important,name,start_time,duration,category
    ,cx,cy+90*count,width,height)
    app.card.append(newCard)
    Seeevent(app)

testevent1 = Event('high','test1','Sat',2,'study','ongoing',False
    )
testevent2 = Event('high','test2','Sat',3,'study','ongoing',False
    )
testevent3 = Event('high','test3','Sat',2,'study','ongoing',False
    )

#This function should allow user to choose
#from which card they want to delete.
def deleteCard(app):
    app.card.pop()
    Seeevent(app)

def mousePressed(app, event):
    x = event.x
    y = event.y
    if DetectEventClick(app,x,y):
        sa

    for button in app.button:
        if (button.action == 'add' 
        and distance(button.cx,button.cy,x,y)<=button.r):
           addCard(app) 
        if (button.action == 'delete' 
        and distance(button.cx,button.cy,x,y)<=button.r):
            deleteCard(app)

def mouseDragged(app,event):
    x = event.x
    y = event.y
    DetectEventClick(app,x,y)

def Seeevent(app):
    for card in app.card:
        newevent = Event(card.important,card.name,card.start_time,card.duration,card.category,
    'Ongoing',False)
        app.event.append(newevent)

def getCellBounds(app, row, col):
    gridWidth  = app.width - 300
    gridHeight = app.height - 50
    cellWidth  = gridWidth / app.grid.width
    cellHeight = gridHeight / app.grid.height
    x0 = app.margin + row * cellWidth
    x1 = app.margin + (row+1) * cellWidth
    y0 = app.margin + col * cellHeight
    y1 = app.margin + (col+1) * cellHeight
    return (x0, y0, x1, y1)

#This is the core algorithm to determine the location of the event
#Now it will not consider the setting of the time prefer
def TimeSorting(app):
    time_sorting = {}
    n = 0
    return TimeSortinghelper(app.card,time_sorting,n)

def TimeSortinghelper(events,time_sorting,n):
    if n == len(events):
        return time_sorting
    else:
        for event in time_sorting:
            remaintime = 24 - time_sorting[event]
        if events[0].duration <= remaintime:
            time_sorting[events[0].name] = events[0].duration
            TimeSortinghelper(events[1:],time_sorting,n+1)
        else:
            time_sorting.pop(events[0])
    return False

def DrawTimeSheet(app,canvas):
    count = 0
    for row in range(app.grid.width):
        (d0,h0,d1,h1) = getCellBounds(app,row,0)
        canvas.create_text((d0+d1)/2,(h0+h1)/2,text=Date[count])
        count = (count+1)%7
        for col in range(app.grid.height):
            (x0,y0,x1,y1) = getCellBounds(app,row,col)
            canvas.create_rectangle(x0,y0,x1,y1)

def DetectEventClick(app,x,y):
    for event in app.event:
        row = Date.index(event.start_time)
        (x0,y0,x1,y1) = getCellBounds(app,row,2)
        if x0<x<x1 and y0<y<y1:
            event.select = True
        else:
            event.select = False
    return event.select

def DrawEvent(app,canvas):
    for event in app.event:
        row = Date.index(event.start_time)
        (x0,y0,x1,y1) = getCellBounds(app,row,2)
        canvas.create_rectangle(x0,y0,x1,y1,fill = 'blue')

def DrawButton(app,canvas):
    for button in app.button:
        canvas.create_oval(button.cx-button.r,
        button.cy-button.r,button.cx+button.r,button.cy+button.r,fill='white',
        outline="black", width=2)
        canvas.create_text(button.cx,
        button.cy,text=button.action)

def DrawCard(app,canvas):
    for card in app.card:
        canvas.create_rectangle(card.cx,card.cy,
        card.cx+card.width,card.cy+card.height)
        canvas.create_text(card.cx+card.width/2,
        card.cy+20,text="Sticky Note",font= 'Arial 10 bold')
        canvas.create_text(card.cx+card.width/2,
        card.cy+40,text=card.name)
        canvas.create_text(card.cx+card.width/2,
        card.cy+60,text=card.category)

def redrawAll(app, canvas):
    DrawButton(app,canvas)
    DrawCard(app,canvas)
    DrawTimeSheet(app,canvas)
    DrawEvent(app,canvas)
runApp(width=800, height=400)


