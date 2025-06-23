import React, { useRef, useEffect, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const Canvas = ({ 
  tool, 
  color, 
  brushSize, 
  elements, 
  setElements, 
  socket, 
  permission = 'edit', 
  roomId,
  selectedElements = [],
  setSelectedElements,
  onTextClick,
  setTool,
  isSelecting = false,
  selectionPath = [],
  selectionArea = null,
  isSelectionClosed = false,
  startFreehandSelection,
  updateFreehandSelection,
  finishFreehandSelection,
  clearSelection
}) => {
  const canvasRef = useRef(null);
  const redrawRef = useRef(null);
  const [action, setAction] = useState('none');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const eraserUpdateTimeout = useRef(null);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set canvas background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    elements.forEach((ele, index) => {
      // Draw the element
      if (ele.type === 'pencil') {
        if (ele.path && ele.path.length >= 4) {
          ctx.beginPath();
          ctx.moveTo(ele.path[0], ele.path[1]);
          for (let i = 2; i < ele.path.length; i += 2) {
            ctx.lineTo(ele.path[i], ele.path[i + 1]);
          }
          ctx.strokeStyle = ele.color;
          ctx.lineWidth = ele.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.globalAlpha = ele.opacity || 1;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      } else if (ele.type === 'rect') {
        const x = Math.min(ele.x, ele.x + ele.width);
        const y = Math.min(ele.y, ele.y + ele.height);
        const width = Math.abs(ele.width);
        const height = Math.abs(ele.height);
        
        ctx.strokeStyle = ele.color;
        ctx.lineWidth = ele.size;
        ctx.globalAlpha = ele.opacity || 1;
        ctx.strokeRect(x, y, width, height);
        ctx.globalAlpha = 1;
      } else if (ele.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(ele.x, ele.y);
        ctx.lineTo(ele.x2, ele.y2);
        ctx.strokeStyle = ele.color;
        ctx.lineWidth = ele.size;
        ctx.lineCap = 'round';
        ctx.globalAlpha = ele.opacity || 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (ele.type === 'circle') {
        ctx.beginPath();
        ctx.arc(ele.x, ele.y, ele.radius, 0, 2 * Math.PI);
        ctx.strokeStyle = ele.color;
        ctx.lineWidth = ele.size;
        ctx.globalAlpha = ele.opacity || 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Draw selection and resize handles (only for edit permission)
      if (selectedElements.some(selected => selected.id === ele.id) && ele.type !== 'pencil' && permission === 'edit') {
        ctx.strokeStyle = '#1890ff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        if (ele.type === 'rect') {
          const x = Math.min(ele.x, ele.x + ele.width);
          const y = Math.min(ele.y, ele.y + ele.height);
          const width = Math.abs(ele.width);
          const height = Math.abs(ele.height);
          
          ctx.strokeRect(x, y, width, height);
          
          // Draw resize handles
          const handleSize = 8;
          ctx.fillStyle = '#1890ff';
          ctx.setLineDash([]);
          const handles = [
            { x, y },
            { x: x + width, y },
            { x, y: y + height },
            { x: x + width, y: y + height }
          ];
          
          handles.forEach(handle => {
            ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
          });
        } else if (ele.type === 'circle') {
          const x = ele.x - ele.radius;
          const y = ele.y - ele.radius;
          const size = ele.radius * 2;
          ctx.strokeRect(x, y, size, size);
          
          // Draw resize handles
          const handleSize = 8;
          ctx.fillStyle = '#1890ff';
          ctx.setLineDash([]);
          const handles = [
            { x: x, y: y },
            { x: x + size, y: y },
            { x: x, y: y + size },
            { x: x + size, y: y + size }
          ];
          
          handles.forEach(handle => {
            ctx.fillRect(handle.x - handleSize/2, handle.y - handleSize/2, handleSize, handleSize);
          });
        } else if (ele.type === 'line') {
          // Draw line selection
          ctx.beginPath();
          ctx.moveTo(ele.x, ele.y);
          ctx.lineTo(ele.x2, ele.y2);
          ctx.stroke();
          
          // Draw endpoint handles
          const handleSize = 8;
          ctx.fillStyle = '#1890ff';
          ctx.setLineDash([]);
          ctx.fillRect(ele.x - handleSize/2, ele.y - handleSize/2, handleSize, handleSize);
          ctx.fillRect(ele.x2 - handleSize/2, ele.y2 - handleSize/2, handleSize, handleSize);
        }
        
        ctx.setLineDash([]);
      }
    });

    // Draw freehand selection path
    if (isSelecting && selectionPath.length >= 4) {
      ctx.beginPath();
      ctx.moveTo(selectionPath[0], selectionPath[1]);
      for (let i = 2; i < selectionPath.length; i += 2) {
        ctx.lineTo(selectionPath[i], selectionPath[i + 1]);
      }
      ctx.strokeStyle = '#1890ff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw selection area
    if (selectionArea && isSelectionClosed) {
      // Draw the selection path
      ctx.beginPath();
      ctx.moveTo(selectionArea.path[0], selectionArea.path[1]);
      for (let i = 2; i < selectionArea.path.length; i += 2) {
        ctx.lineTo(selectionArea.path[i], selectionArea.path[i + 1]);
      }
      ctx.closePath();
      ctx.strokeStyle = '#1890ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Fill with semi-transparent color
      ctx.fillStyle = 'rgba(24, 144, 255, 0.1)';
      ctx.fill();
    }

    // Draw eraser indicator when eraser tool is active
    if (tool === 'eraser' && permission === 'edit') {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      const eraserSize = Math.max(brushSize, 8);
      const halfSize = eraserSize / 2;
      ctx.strokeRect(mousePos.x - halfSize, mousePos.y - halfSize, eraserSize, eraserSize);
      ctx.setLineDash([]);
      
      // Add a crosshair in the center for better precision
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(mousePos.x - 5, mousePos.y);
      ctx.lineTo(mousePos.x + 5, mousePos.y);
      ctx.moveTo(mousePos.x, mousePos.y - 5);
      ctx.lineTo(mousePos.x, mousePos.y + 5);
      ctx.stroke();
    }
  }, [elements, selectedElements, permission, isSelecting, selectionPath, selectionArea, isSelectionClosed, tool, mousePos, brushSize]);

  // Update redraw reference
  useEffect(() => {
    redrawRef.current = redrawCanvas;
  }, [redrawCanvas]);

  // Initialize canvas and setup resize listener
  useEffect(() => {
    console.log('Canvas: Initializing canvas and setup resize listener');
    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      if (!canvas || !canvas.parentElement) {
        console.log('Canvas: No canvas or parent element found');
        return;
      }
      
      const parentRect = canvas.parentElement.getBoundingClientRect();
      console.log('Canvas: Parent element rect:', parentRect);
      
      if (parentRect.width === 0 || parentRect.height === 0) {
        console.log('Canvas: Parent element has zero dimensions, retrying in 100ms');
        setTimeout(updateCanvasSize, 100);
        return;
      }
      
      // Get device pixel ratio for high DPI displays
      const dpr = window.devicePixelRatio || 1;
      
      // Set the canvas size to match the display size
      canvas.style.width = parentRect.width + 'px';
      canvas.style.height = parentRect.height + 'px';
      
      // Set the actual canvas size accounting for device pixel ratio
      canvas.width = parentRect.width * dpr;
      canvas.height = parentRect.height * dpr;
      
      // Scale the context to account for device pixel ratio
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      
      console.log('Canvas: Setting canvas size to', parentRect.width, 'x', parentRect.height, 'with DPR:', dpr);
      
      // Force a redraw after setting size
      if (redrawRef.current) {
        redrawRef.current();
      }
    };
    
    const handleResize = () => {
      console.log('Canvas: Window resized, updating canvas');
      updateCanvasSize();
    };
    
    // Initial setup with a small delay to ensure DOM is ready
    setTimeout(updateCanvasSize, 100);
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Redraw when elements change
  useEffect(() => {
    console.log('Canvas: Elements changed, redrawing canvas. Elements count:', elements.length);
    redrawRef.current();
  }, [elements]);

  // Get mouse position
  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  // Mouse enter handler for eraser indicator
  const handleMouseEnter = (e) => {
    if (permission === 'view') return;
    const mousePos = getMousePos(e);
    setMousePos(mousePos);
  };

  // Mouse down handler
  const handleMouseDown = (e) => {
    if (permission === 'view') return; // Disable interaction for view-only users
    
    const mousePos = getMousePos(e);
    
    // Check for element selection (works with any tool, not just scissors)
    const clickedElementIndex = elements.findIndex(ele => {
      if (ele.type === 'rect') {
        const x = Math.min(ele.x, ele.x + ele.width);
        const y = Math.min(ele.y, ele.y + ele.height);
        const width = Math.abs(ele.width);
        const height = Math.abs(ele.height);
        return mousePos.x >= x && mousePos.x <= x + width && mousePos.y >= y && mousePos.y <= y + height;
      }
      if (ele.type === 'circle') {
        const dist = Math.hypot(mousePos.x - ele.x, mousePos.y - ele.y);
        return dist <= ele.radius;
      }
      if (ele.type === 'line') {
        return distToSegment(mousePos, { x: ele.x, y: ele.y }, { x: ele.x2, y: ele.y2 }) < 5;
      }
      return false;
    });

    if (clickedElementIndex > -1) {
      const clickedElement = elements[clickedElementIndex];
      
      // Handle multi-selection with Ctrl/Cmd key
      if (e.ctrlKey || e.metaKey) {
        if (selectedElements.some(selected => selected.id === clickedElement.id)) {
          // Deselect if already selected
          setSelectedElements(prev => prev.filter(selected => selected.id !== clickedElement.id));
        } else {
          // Add to selection
          setSelectedElements(prev => [...prev, clickedElement]);
        }
      } else {
        // Single selection
        setSelectedElements([clickedElement]);
      }
      
      // Set the selected index for resizing
      setSelectedIndex(clickedElementIndex);
      setAction('moving');
      dragStart.current = mousePos;
      return;
    }

    // Check if clicking on resize handle of selected element
    if (selectedElements.length === 1) {
      const element = selectedElements[0];
      const elementIndex = elements.findIndex(ele => ele.id === element.id);
      
      if (elementIndex !== -1) {
        if (element.type === 'rect') {
          const x = Math.min(element.x, element.x + element.width);
          const y = Math.min(element.y, element.y + element.height);
          const width = Math.abs(element.width);
          const height = Math.abs(element.height);
          
          const handles = [
            { x, y },
            { x: x + width, y },
            { x, y: y + height },
            { x: x + width, y: y + height }
          ];
          
          for (let i = 0; i < handles.length; i++) {
            const dx = Math.abs(mousePos.x - handles[i].x);
            const dy = Math.abs(mousePos.y - handles[i].y);
            if (dx < 8 && dy < 8) { // more forgiving handle size
              setAction('resizing');
              setResizeHandle(i);
              setSelectedIndex(elementIndex);
              dragStart.current = mousePos;
              return;
            }
          }
        } else if (element.type === 'circle') {
          // For circle, allow resizing by clicking near the edge
          const dist = Math.hypot(mousePos.x - element.x, mousePos.y - element.y);
          if (Math.abs(dist - element.radius) < 12) { // more forgiving handle size
            setAction('resizing');
            setResizeHandle('radius');
            setSelectedIndex(elementIndex);
            dragStart.current = mousePos;
            return;
          }
        } else if (element.type === 'line') {
          const dx1 = Math.abs(mousePos.x - element.x);
          const dy1 = Math.abs(mousePos.y - element.y);
          const dx2 = Math.abs(mousePos.x - element.x2);
          const dy2 = Math.abs(mousePos.y - element.y2);
          
          if (dx1 < 5 && dy1 < 5) {
            setAction('resizing');
            setResizeHandle('start');
            setSelectedIndex(elementIndex);
            dragStart.current = mousePos;
            return;
          } else if (dx2 < 5 && dy2 < 5) {
            setAction('resizing');
            setResizeHandle('end');
            setSelectedIndex(elementIndex);
            dragStart.current = mousePos;
            return;
          }
        }
      }
    }

    // Only clear selection when clicking on empty space and not starting to draw immediately
    // This allows shapes to remain selected for editing
    if (!e.ctrlKey && !e.metaKey && !isDrawingMode) {
      setSelectedElements([]);
      setSelectedIndex(null);
    }

    // Start drawing new element
    setAction('drawing');
    setIsDrawingMode(true);
    dragStart.current = mousePos;

    if (tool === 'pencil') {
      const newElement = {
        id: uuidv4(),
        type: 'pencil',
        path: [mousePos.x, mousePos.y],
        color,
        size: brushSize
      };
      setElements(prev => [...prev, newElement]);
    } else if (tool === 'rect') {
      const newElement = {
        id: uuidv4(),
        type: 'rect',
        x: mousePos.x,
        y: mousePos.y,
        width: 0,
        height: 0,
        color,
        size: brushSize
      };
      setElements(prev => [...prev, newElement]);
    } else if (tool === 'line') {
      const newElement = {
        id: uuidv4(),
        type: 'line',
        x: mousePos.x,
        y: mousePos.y,
        x2: mousePos.x,
        y2: mousePos.y,
        color,
        size: brushSize
      };
      setElements(prev => [...prev, newElement]);
    } else if (tool === 'circle') {
      const newElement = {
        id: uuidv4(),
        type: 'circle',
        x: mousePos.x,
        y: mousePos.y,
        startX: mousePos.x,
        startY: mousePos.y,
        radius: 0,
        color,
        size: brushSize
      };
      setElements(prev => [...prev, newElement]);
    } else if (tool === 'eraser') {
      setAction('erasing');
    }

    if (["pencil","rect","line","circle"].includes(tool)) {
      setSelectedElements([]);
      setSelectedIndex(null);
    }

    if (selectedElements.length === 1 && selectedElements[0].type === 'circle') {
      const element = selectedElements[0];
      const elementIndex = elements.findIndex(ele => ele.id === element.id);
      const x = element.x - element.radius;
      const y = element.y - element.radius;
      const size = element.radius * 2;
      const handles = [
        { x: x, y: y },
        { x: x + size, y: y },
        { x: x, y: y + size },
        { x: x + size, y: y + size }
      ];
      for (let i = 0; i < handles.length; i++) {
        const dx = Math.abs(mousePos.x - handles[i].x);
        const dy = Math.abs(mousePos.y - handles[i].y);
        if (dx < 8 && dy < 8) {
          setAction('resizing');
          setResizeHandle(i);
          setSelectedIndex(elementIndex);
          dragStart.current = mousePos;
          return;
        }
      }
    }
  };

  // Mouse move handler
  const handleMouseMove = (e) => {
    if (permission === 'view') return; // Disable interaction for view-only users
    
    const mousePos = getMousePos(e);
    setMousePos(mousePos); // Update mouse position for eraser indicator
    
    // Trigger redraw for eraser indicator
    if (tool === 'eraser' && !action) {
      redrawRef.current();
    }
    
    // Trigger redraw during erasing for better visual feedback (throttled)
    if (action === 'erasing') {
      // Throttle eraser updates to improve performance
      if (!eraserUpdateTimeout.current) {
        eraserUpdateTimeout.current = setTimeout(() => {
          redrawRef.current();
          eraserUpdateTimeout.current = null;
        }, 16); // ~60fps
      }
    }
    
    if (action === 'drawing') {
      const lastElement = elements[elements.length - 1];
      if (!lastElement) return;
      
      if (lastElement.type === 'pencil') {
        lastElement.path.push(mousePos.x, mousePos.y);
        setElements([...elements]);
      } else if (lastElement.type === 'rect') {
        lastElement.width = mousePos.x - lastElement.x;
        lastElement.height = mousePos.y - lastElement.y;
        setElements([...elements]);
      } else if (lastElement.type === 'line') {
        lastElement.x2 = mousePos.x;
        lastElement.y2 = mousePos.y;
        setElements([...elements]);
      } else if (lastElement.type === 'circle') {
        // Bounding box style: calculate center and radius from dragStart to mousePos
        const startX = lastElement.startX !== undefined ? lastElement.startX : lastElement.x;
        const startY = lastElement.startY !== undefined ? lastElement.startY : lastElement.y;
        const centerX = (startX + mousePos.x) / 2;
        const centerY = (startY + mousePos.y) / 2;
        const width = Math.abs(mousePos.x - startX);
        const height = Math.abs(mousePos.y - startY);
        const radius = Math.max(width, height) / 2;
        lastElement.x = centerX;
        lastElement.y = centerY;
        lastElement.radius = Math.max(1, radius);
        setElements([...elements]);
      }
    } else if (action === 'erasing') {
      // Improved eraser that works like a real eraser - removes only parts it touches
      let hasChanges = false;
      const newElements = [];
      const eraserSize = Math.max(brushSize, 8);
      const halfEraserSize = eraserSize / 2;
      // Calculate eraser bounding box (top-left and bottom-right)
      const eraserBox = {
        left: mousePos.x - halfEraserSize,
        right: mousePos.x + halfEraserSize,
        top: mousePos.y - halfEraserSize,
        bottom: mousePos.y + halfEraserSize
      };
      elements.forEach(ele => {
        if (ele.type === 'pencil') {
          // For pencil strokes, check if eraser is touching any part and split/remove those parts
          const segments = [];
          let currentSegment = [];
          for (let i = 0; i < ele.path.length - 2; i += 2) {
            const a = { x: ele.path[i], y: ele.path[i+1] };
            const b = { x: ele.path[i+2], y: ele.path[i+3] };
            // Check if either endpoint is inside the eraser box
            const aInEraser = a.x >= eraserBox.left && a.x <= eraserBox.right && a.y >= eraserBox.top && a.y <= eraserBox.bottom;
            const bInEraser = b.x >= eraserBox.left && b.x <= eraserBox.right && b.y >= eraserBox.top && b.y <= eraserBox.bottom;
            if (!aInEraser && !bInEraser) {
              // This segment is not touched by eraser, add to current segment
              if (currentSegment.length === 0) {
                currentSegment.push(ele.path[i], ele.path[i+1]);
              }
              currentSegment.push(ele.path[i+2], ele.path[i+3]);
            } else {
              // This segment is touched by eraser
              if (currentSegment.length >= 4) {
                segments.push([...currentSegment]);
                hasChanges = true;
              }
              currentSegment = [];
            }
          }
          // Add the last point if it wasn't erased
          if (ele.path.length >= 2) {
            const lastPoint = { x: ele.path[ele.path.length - 2], y: ele.path[ele.path.length - 1] };
            const lastInEraser = lastPoint.x >= eraserBox.left && lastPoint.x <= eraserBox.right && lastPoint.y >= eraserBox.top && lastPoint.y <= eraserBox.bottom;
            if (!lastInEraser && currentSegment.length === 0) {
              currentSegment.push(ele.path[ele.path.length - 2], ele.path[ele.path.length - 1]);
            }
          }
          if (currentSegment.length >= 4) {
            segments.push(currentSegment);
            hasChanges = true;
          }
          segments.forEach(segment => {
            newElements.push({
              ...ele,
              id: Date.now() + Math.random(),
              path: segment
            });
          });
          if (segments.length === 0) {
            hasChanges = true;
          }
        } else {
          if (ele.type === 'rect') {
            const x = Math.min(ele.x, ele.x + ele.width);
            const y = Math.min(ele.y, ele.y + ele.height);
            const width = Math.abs(ele.width);
            const height = Math.abs(ele.height);
            // Rectangle bounding box
            const rectBox = {
              left: x,
              right: x + width,
              top: y,
              bottom: y + height
            };
            // Check if eraser box overlaps with rectangle box
            const isTouching =
              eraserBox.left < rectBox.right &&
              eraserBox.right > rectBox.left &&
              eraserBox.top < rectBox.bottom &&
              eraserBox.bottom > rectBox.top;
            if (isTouching) {
              const currentOpacity = ele.opacity || 1;
              const newOpacity = Math.max(0.02, currentOpacity - 0.3);
              if (newOpacity <= 0.02) {
                hasChanges = true;
              } else {
                newElements.push({ ...ele, opacity: newOpacity });
                hasChanges = true;
              }
            } else {
              newElements.push(ele);
            }
          } else if (ele.type === 'circle') {
            const circleBox = {
              left: ele.x - ele.radius,
              right: ele.x + ele.radius,
              top: ele.y - ele.radius,
              bottom: ele.y + ele.radius
            };
            // Check if eraser box overlaps with circle bounding box
            const isTouching =
              eraserBox.left < circleBox.right &&
              eraserBox.right > circleBox.left &&
              eraserBox.top < circleBox.bottom &&
              eraserBox.bottom > circleBox.top;
            if (isTouching) {
              const currentOpacity = ele.opacity || 1;
              const newOpacity = Math.max(0.02, currentOpacity - 0.3);
              if (newOpacity <= 0.02) {
                hasChanges = true;
              } else {
                newElements.push({ ...ele, opacity: newOpacity });
                hasChanges = true;
              }
            } else {
              newElements.push(ele);
            }
          } else if (ele.type === 'line') {
            // Brush-like erasing for lines: split the line if eraser touches it
            const a = { x: ele.x, y: ele.y };
            const b = { x: ele.x2, y: ele.y2 };
            // Find closest point on the line to the eraser center
            const eraserCenter = { x: mousePos.x, y: mousePos.y };
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy);
            if (len === 0) return; // skip degenerate lines
            const t = ((eraserCenter.x - a.x) * dx + (eraserCenter.y - a.y) * dy) / (len * len);
            const closest = {
              x: a.x + t * dx,
              y: a.y + t * dy
            };
            const dist = Math.hypot(eraserCenter.x - closest.x, eraserCenter.y - closest.y);
            const eraserRadius = halfEraserSize;
            if (dist < eraserRadius && t > 0 && t < 1) {
              // Split the line into two segments at the eraser position
              newElements.push({ ...ele, x2: closest.x, y2: closest.y });
              newElements.push({ ...ele, x: closest.x, y: closest.y });
              hasChanges = true;
            } else if (dist < eraserRadius && (t <= 0 || t >= 1)) {
              // Eraser is near an endpoint, remove the line
              hasChanges = true;
            } else {
              newElements.push(ele);
            }
          } else {
            newElements.push(ele);
          }
        }
      });
      if (hasChanges) {
        setElements(newElements);
        if (socket && roomId) {
          socket.emit('drawing', newElements);
        }
      }
    } else if (action === 'moving' && selectedElements.length === 1) {
      const element = elements[selectedIndex];
      const dx = mousePos.x - dragStart.current.x;
      const dy = mousePos.y - dragStart.current.y;

      // Move all selected elements
      selectedElements.forEach(selectedElement => {
        const element = elements.find(ele => ele.id === selectedElement.id);
        if (element) {
          if (element.type === 'pencil') {
            for (let i = 0; i < element.path.length; i += 2) {
              element.path[i] += dx;
              element.path[i + 1] += dy;
            }
          } else if (element.type === 'rect' || element.type === 'circle') {
            element.x += dx;
            element.y += dy;
          } else if (element.type === 'line') {
            element.x += dx;
            element.y += dy;
            element.x2 += dx;
            element.y2 += dy;
          }
        }
      });

      dragStart.current = mousePos;
      setElements([...elements]);

      // Emit drawing update to server
      if (socket && roomId) {
        socket.emit('drawing', elements);
      }
    } else if (action === 'resizing' && selectedIndex !== null) {
      const element = elements[selectedIndex];
      const dx = mousePos.x - dragStart.current.x;
      const dy = mousePos.y - dragStart.current.y;

      if (element.type === 'rect') {
        if (resizeHandle === 0) { // Top-left
          element.x += dx;
          element.y += dy;
          element.width -= dx;
          element.height -= dy;
        } else if (resizeHandle === 1) { // Top-right
          element.y += dy;
          element.width += dx;
          element.height -= dy;
        } else if (resizeHandle === 2) { // Bottom-left
          element.x += dx;
          element.width -= dx;
          element.height += dy;
        } else if (resizeHandle === 3) { // Bottom-right
          element.width += dx;
          element.height += dy;
        }
      } else if (element.type === 'circle') {
        // Treat the circle as a bounding box, just like a rect
        let x = element.x - element.radius;
        let y = element.y - element.radius;
        let width = element.radius * 2;
        let height = element.radius * 2;
        // 0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right
        if (resizeHandle === 0) {
          x += dx;
          y += dy;
          width -= dx;
          height -= dy;
        } else if (resizeHandle === 1) {
          y += dy;
          width += dx;
          height -= dy;
        } else if (resizeHandle === 2) {
          x += dx;
          width -= dx;
          height += dy;
        } else if (resizeHandle === 3) {
          width += dx;
          height += dy;
        }
        // Ensure minimum size
        width = Math.max(10, width);
        height = Math.max(10, height);
        // Update center and radius
        element.x = x + width / 2;
        element.y = y + height / 2;
        element.radius = Math.max(width, height) / 2;
      } else if (element.type === 'line') {
        if (resizeHandle === 'start') {
          element.x += dx;
          element.y += dy;
        } else if (resizeHandle === 'end') {
          element.x2 += dx;
          element.y2 += dy;
        }
      }

      dragStart.current = mousePos;
      setElements([...elements]);

      // Emit drawing update to server
      if (socket && roomId) {
        socket.emit('drawing', elements);
      }
    }
  };

  // Mouse up handler
  const handleMouseUp = () => {
    if (permission === 'view') return; // Disable interaction for view-only users
    
    // Clear eraser update timeout
    if (eraserUpdateTimeout.current) {
      clearTimeout(eraserUpdateTimeout.current);
      eraserUpdateTimeout.current = null;
    }
    
    if (action === 'drawing') {
      // Auto-select the newly drawn element for immediate editing
      const lastElement = elements[elements.length - 1];
      if (lastElement && lastElement.type !== 'pencil') {
        setSelectedElements([lastElement]);
        setSelectedIndex(elements.length - 1);
        // Don't switch tools - keep the current tool active
        // This allows immediate editing while maintaining the drawing tool
      }
      
      // Emit final drawing update to server
      if (socket && roomId) {
        socket.emit('drawing', elements);
        // Also emit canvas update for persistence
        socket.emit('canvas-update', { canvasData: elements });
      }
    } else if (action === 'moving' || action === 'resizing') {
      // Emit final drawing update to server
      if (socket && roomId) {
        socket.emit('drawing', elements);
        // Also emit canvas update for persistence
        socket.emit('canvas-update', { canvasData: elements });
      }
    } else if (action === 'erasing') {
      // For eraser, emit the final state
      if (socket && roomId) {
        socket.emit('drawing', elements);
        // Also emit canvas update for persistence
        socket.emit('canvas-update', { canvasData: elements });
      }
    }
    
    // Reset action state
    setAction('none');
    setResizeHandle(null);
    setIsDrawingMode(false);
  };

  // Double-click handler to close selection loop
  const handleDoubleClick = (e) => {
    if (permission === 'view') return;
  };

  const distToSegment = (p, v, w) => {
    const l2 = (v.x - w.x)**2 + (v.y - w.y)**2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  }

  console.log('Canvas: Rendering canvas component with', elements.length, 'elements');

  return (
    <div className="canvas-container">
      <canvas
        ref={canvasRef}
        className={`whiteboard-canvas ${permission === 'view' ? 'view-only' : ''}`}
        data-tool={tool}
        data-action={action}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        style={{ 
          cursor: permission === 'view' ? 'default' : 
            action === 'moving' ? 'move' :
            action === 'resizing' ? 'nw-resize' :
            tool === 'eraser' ? 'cell' : 
            tool === 'pencil' ? 'crosshair' :
            tool === 'rect' ? 'crosshair' :
            tool === 'line' ? 'crosshair' :
            tool === 'circle' ? 'crosshair' :
            'crosshair' 
        }}
      />
    </div>
  );
};

export default Canvas;
