import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import Client from "../components/Client";
import Editor from "../components/Editor";
import ExecutionPanel from "../components/ExecutionPanel";
import { language, cmtheme } from "../atoms";
import { useRecoilState } from "recoil";
import ACTIONS from "../actions/Actions";
import { initSocket } from "../socket";
import {
  useLocation,
  useNavigate,
  Navigate,
  useParams,
} from "react-router-dom";
import { Socket } from "socket.io-client";

interface ClientType {
  socketId: string;
  username: string;
}

interface LocationState {
  username: string;
}

const EditorPage: React.FC = () => {
  const [lang, setLang] = useRecoilState(language);
  const [them, setThem] = useRecoilState(cmtheme);

  const [clients, setClients] = useState<ClientType[]>([]);
  const [isExecutionPanelVisible, setIsExecutionPanelVisible] = useState(true);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [editorHeight, setEditorHeight] = useState(60); // Percentage
  const [isResizing, setIsResizing] = useState(false);
  const [sharedTestCases, setSharedTestCases] = useState<Array<{
    functionName: string;
    inputs: string;
    expected: string;
    name: string;
    userInputs?: string;
    programInputs?: string;
    expectedOutput?: string;
  }>>([]);

  const socketRef = useRef<Socket | null>(null);
  const codeRef = useRef<string | null>(null);
  const location = useLocation();
  const { roomId } = useParams<{ roomId: string }>();
  const reactNavigator = useNavigate();
  const username = (location.state as LocationState)?.username;

  // Load boilerplate code immediately when component mounts
  useEffect(() => {
    console.log('Loading initial boilerplate for language:', lang);
    const boilerplate = getBoilerplateCode(lang);
    if (boilerplate) {
      console.log('Setting boilerplate code:', boilerplate.substring(0, 50) + '...');
      codeRef.current = boilerplate;
      setCurrentCode(boilerplate);
    }
  }, []); // Run only once on mount

  // Load boilerplate when language changes
  useEffect(() => {
    console.log('Language changed to:', lang, 'Loading boilerplate...');
    const boilerplate = getBoilerplateCode(lang);
    if (boilerplate) {
      console.log('Setting boilerplate for new language');
      codeRef.current = boilerplate;
      setCurrentCode(boilerplate);
    }
  }, [lang]); // Run when language changes

  useEffect(() => {
    const init = async () => {
      // Prevent multiple socket connections
      if (socketRef.current && socketRef.current.connected) {
        return;
      }

      // Disconnect any existing socket first
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      socketRef.current = await initSocket();
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      function handleErrors(e: any) {
        console.log("socket error", e);
        toast.error("Socket connection failed, try again later.");
        reactNavigator("/");
      }

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username,
      });

      // Listening for joined event
      socketRef.current.on(
        ACTIONS.JOINED,
        ({ clients, username: joinedUsername, socketId }: { clients: ClientType[], username: string, socketId: string }) => {
          if (joinedUsername !== username) {
            toast.success(`${joinedUsername} joined the room.`);
            console.log(`${joinedUsername} joined`);
          }
          setClients(clients);
          
          // Only sync code if we have meaningful content, otherwise let new user keep their boilerplate
          const codeToSync = codeRef.current && codeRef.current.trim() !== '' ? codeRef.current : null;
          if (codeToSync) {
            socketRef.current?.emit(ACTIONS.SYNC_CODE, {
              code: codeToSync,
              socketId,
            });
          }

          // Sync current language to new user
          if (lang) {
            socketRef.current?.emit(ACTIONS.SYNC_LANGUAGE, {
              language: lang,
              socketId,
            });
          }

          // Sync test cases to new user
          if (sharedTestCases.length > 0) {
            socketRef.current?.emit(ACTIONS.SYNC_TEST_CASES, {
              testCases: sharedTestCases,
              socketId,
            });
          }
        }
      );

      // Listening for disconnected
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }: { socketId: string, username: string }) => {
        toast.success(`${username} left the room.`);
        setClients((prev) => {
          return prev.filter((client) => client.socketId !== socketId);
        });
      });

      // Listening for language changes
      socketRef.current.on(ACTIONS.LANGUAGE_CHANGE, ({ language }: { language: string }) => {
        console.log('Received language change:', language);
        setLang(language);
        toast.info(`Language changed to ${language}`);
      });

      // Listening for test case changes
      socketRef.current.on(ACTIONS.TEST_CASES_CHANGE, ({ testCases }: { testCases: any[] }) => {
        console.log('Received test cases change:', testCases);
        setSharedTestCases(testCases);
        toast.info('Test cases updated by another user');
      });
    };
    
    // Load boilerplate first, then initialize socket
    const boilerplate = getBoilerplateCode(lang);
    if (boilerplate) {
      console.log('Setting initial boilerplate before socket init');
      codeRef.current = boilerplate;
      setCurrentCode(boilerplate);
    }
    
    init();
    
    // Emit boilerplate to socket after connection is established
    setTimeout(() => {
      if (socketRef.current && boilerplate) {
        socketRef.current.emit(ACTIONS.CODE_CHANGE, {
          roomId,
          code: boilerplate
        });
      }
    }, 500); // Short delay just for socket connection
    
    return () => {
      if (socketRef.current) {
        socketRef.current.off(ACTIONS.JOINED);
        socketRef.current.off(ACTIONS.DISCONNECTED);
        socketRef.current.off(ACTIONS.LANGUAGE_CHANGE);
        socketRef.current.off(ACTIONS.TEST_CASES_CHANGE);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [roomId, username]);

  // Add keyboard shortcuts for code execution
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to run code
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (currentCode.trim() && isExecutionPanelVisible) {
          // Trigger execution by dispatching a custom event
          const executionEvent = new CustomEvent('executeCode', { detail: { code: currentCode } });
          window.dispatchEvent(executionEvent);
        }
      }
      
      // Ctrl+Shift+E or Cmd+Shift+E to toggle execution panel
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'E') {
        event.preventDefault();
        setIsExecutionPanelVisible(!isExecutionPanelVisible);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentCode, isExecutionPanelVisible]);

  // Handle resize functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const container = document.querySelector('.editorLayout') as HTMLElement;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
      
      // Limit between 20% and 80%
      const clampedHeight = Math.max(20, Math.min(80, newHeight));
      setEditorHeight(clampedHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleCodeChange = (code: string) => {
    console.log("on code change" + code);
    codeRef.current = code;
    setCurrentCode(code);
  };

  // Handle test case updates from ExecutionPanel
  const handleTestCasesChange = (testCases: typeof sharedTestCases) => {
    console.log('Updating shared test cases:', testCases);
    setSharedTestCases(testCases);
    
    // Emit test cases change to other users
    if (socketRef.current) {
      console.log('Emitting test cases to other users');
      socketRef.current.emit(ACTIONS.TEST_CASES_CHANGE, {
        roomId,
        testCases
      });
    }
  };

  const getBoilerplateCode = (language: string): string => {
    switch (language) {
      case 'javascript':
        return `// JavaScript Code
function solve() {
    // Write your solution here
    return "Hello World!";
}

console.log(solve());`;
      case 'python':
        return `# Python Code
def solve():
    # Write your solution here
    return "Hello World!"

print(solve())`;
      case 'java':
        return `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        
        // Write your solution here
        System.out.println("Hello World!");
        
        sc.close();
    }
}`;
      default:
        return '';
    }
  };



  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId || '');
      toast.success("Room ID has been copied to clipboard");
    } catch (err) {
      toast.error("Could not copy the Room ID");
      console.error(err);
    }
  }

  function leaveRoom() {
    reactNavigator("/");
  }

  if (!location.state) {
    return <Navigate to="/" />;
  }

  return (
    <div className="mainWrap">
      <div className="aside">
        <div className="asideInner">
          <div className="logo">
            <img className="logoImage" src="/logo.png" alt="CodeSync" />
          </div>
          <h3>Connected</h3>
          <div className="clientsList">
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>

        <label>
          Select Language:
          <select
            value={lang}
            onChange={(e) => {
              const newLanguage = e.target.value;
              console.log('Manual language change to:', newLanguage);
              setLang(newLanguage);
              
              // Emit language change to other users
              if (socketRef.current) {
                console.log('Emitting language change to other users');
                socketRef.current.emit(ACTIONS.LANGUAGE_CHANGE, {
                  roomId,
                  language: newLanguage
                });
              }
              
              // Automatically load boilerplate code for the new language
              const boilerplate = getBoilerplateCode(newLanguage);
              if (boilerplate) {
                console.log('Loading boilerplate for manual language change:', boilerplate.substring(0, 30) + '...');
                // Always load boilerplate when language changes - immediately update UI
                codeRef.current = boilerplate;
                setCurrentCode(boilerplate);
                
                // Emit code change after a short delay to ensure it doesn't conflict
                setTimeout(() => {
                  if (socketRef.current) {
                    console.log('Emitting boilerplate code to other users');
                    socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                      roomId,
                      code: boilerplate
                    });
                  }
                }, 100);
              }
            }}
            className="seLang"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </label>

        <button
          className="boilerplateBtn"
          onClick={() => {
            const boilerplate = getBoilerplateCode(lang);
            if (boilerplate) {
              codeRef.current = boilerplate;
              setCurrentCode(boilerplate);
              
              // Emit to socket if connected
              if (socketRef.current) {
                socketRef.current.emit(ACTIONS.CODE_CHANGE, {
                  roomId,
                  code: boilerplate
                });
              }
            }
          }}
          title="Load boilerplate code for current language"
        >
          Load Boilerplate
        </button>

        <label>
          Select Theme:
          <select
            value={them}
            onChange={(e) => {
              //   setCode(codeRef.current);
              setThem(e.target.value);
              //   window.location.reload();
            }}
            className="seLang"
          >
            <option value="default">default</option>
            <option value="3024-day">3024-day</option>
            <option value="3024-night">3024-night</option>
            <option value="abbott">abbott</option>
            <option value="abcdef">abcdef</option>
            <option value="ambiance">ambiance</option>
            <option value="ayu-dark">ayu-dark</option>
            <option value="ayu-mirage">ayu-mirage</option>
            <option value="base16-dark">base16-dark</option>
            <option value="base16-light">base16-light</option>
            <option value="bespin">bespin</option>
            <option value="blackboard">blackboard</option>
            <option value="cobalt">cobalt</option>
            <option value="colorforth">colorforth</option>
            <option value="darcula">darcula</option>
            <option value="duotone-dark">duotone-dark</option>
            <option value="duotone-light">duotone-light</option>
            <option value="eclipse">eclipse</option>
            <option value="elegant">elegant</option>
            <option value="erlang-dark">erlang-dark</option>
            <option value="gruvbox-dark">gruvbox-dark</option>
            <option value="hopscotch">hopscotch</option>
            <option value="icecoder">icecoder</option>
            <option value="idea">idea</option>
            <option value="isotope">isotope</option>
            <option value="juejin">juejin</option>
            <option value="lesser-dark">lesser-dark</option>
            <option value="liquibyte">liquibyte</option>
            <option value="lucario">lucario</option>
            <option value="material">material</option>
            <option value="material-darker">material-darker</option>
            <option value="material-palenight">material-palenight</option>
            <option value="material-ocean">material-ocean</option>
            <option value="mbo">mbo</option>
            <option value="mdn-like">mdn-like</option>
            <option value="midnight">midnight</option>
            <option value="monokai">monokai</option>
            <option value="moxer">moxer</option>
            <option value="neat">neat</option>
            <option value="neo">neo</option>
            <option value="night">night</option>
            <option value="nord">nord</option>
            <option value="oceanic-next">oceanic-next</option>
            <option value="panda-syntax">panda-syntax</option>
            <option value="paraiso-dark">paraiso-dark</option>
            <option value="paraiso-light">paraiso-light</option>
            <option value="pastel-on-dark">pastel-on-dark</option>
            <option value="railscasts">railscasts</option>
            <option value="rubyblue">rubyblue</option>
            <option value="seti">seti</option>
            <option value="shadowfox">shadowfox</option>
            <option value="solarized">solarized</option>
            <option value="the-matrix">the-matrix</option>
            <option value="tomorrow-night-bright">tomorrow-night-bright</option>
            <option value="tomorrow-night-eighties">
              tomorrow-night-eighties
            </option>
            <option value="ttcn">ttcn</option>
            <option value="twilight">twilight</option>
            <option value="vibrant-ink">vibrant-ink</option>
            <option value="xq-dark">xq-dark</option>
            <option value="xq-light">xq-light</option>
            <option value="yeti">yeti</option>
            <option value="yonce">yonce</option>
            <option value="zenburn">zenburn</option>
          </select>
        </label>

        <button className="btn copyBtn" onClick={copyRoomId}>
          Copy ROOM ID
        </button>
        <button className="btn leaveBtn" onClick={leaveRoom}>
          Leave
        </button>
      </div>

      <div className="editorWrap">
        <div className="editorHeader">
          <button 
            className="execution-toggle-btn"
            onClick={() => setIsExecutionPanelVisible(!isExecutionPanelVisible)}
            title={`${isExecutionPanelVisible ? 'Hide' : 'Show'} execution panel (Ctrl+Shift+E)`}
          >
            {isExecutionPanelVisible ? '🔽 Hide Execution' : '🔼 Show Execution'}
          </button>
        </div>
        <div className="editorLayout resizable-layout">
          <div 
            className="editorContainer"
            style={{ height: isExecutionPanelVisible ? `${editorHeight}%` : '100%' }}
          >
            <Editor
              socketRef={socketRef}
              roomId={roomId}
              onCodeChange={handleCodeChange}
            />
          </div>
          {isExecutionPanelVisible && (
            <>
              <div 
                className="resize-handle"
                onMouseDown={handleMouseDown}
              >
                <div className="resize-line"></div>
              </div>
              <div 
                className="executionContainer"
                style={{ height: `${100 - editorHeight}%` }}
              >
                <ExecutionPanel
                  code={currentCode}
                  isVisible={isExecutionPanelVisible}
                  onToggle={() => setIsExecutionPanelVisible(!isExecutionPanelVisible)}
                  sharedTestCases={sharedTestCases}
                  onTestCasesChange={handleTestCasesChange}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditorPage;