<script>
  import { onMount } from 'svelte'
  
  export let headerText = ''
  export let onContentChange = () => {}
  export let onSave = () => {}
  
  let editorElement = null
  
  // Handle input changes
  const handleInput = (event) => {
    headerText = event.target.innerHTML
    onContentChange(event.target.innerHTML)
    
    // Process any new images that might have been added
    setTimeout(() => {
      makeImagesResizable()
    }, 100)
  }
  
  const handleBlur = (event) => {
    onSave(event.target.innerHTML)
  }
  
  // Apply formatting
  const applyFormatting = (command, value = null) => {
    if (editorElement) {
      editorElement.focus()
      
      if (command === 'fontSize') {
        // Handle font size with CSS
        document.execCommand('fontSize', false, '7') // Use a dummy font size
        // Find the font tag and replace with span with proper style
        const fontTags = editorElement.querySelectorAll('font[size="7"]')
        fontTags.forEach(font => {
          const span = document.createElement('span')
          span.style.fontSize = value
          span.innerHTML = font.innerHTML
          font.parentNode.replaceChild(span, font)
        })
      } else {
        document.execCommand(command, false, value)
      }
      
      handleInput({ target: { innerHTML: editorElement.innerHTML } })
      
      // Make images resizable after any change
      makeImagesResizable()
    }
  }
  
  // Handle logo upload
  const handleLogoUpload = async (event) => {
    const file = event.target.files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const imageData = e.target.result
        
        if (editorElement) {
          editorElement.focus()
          
          // Create image HTML with proper attributes
          const imgHtml = `<img src="${imageData}" alt="Logo" style="position: absolute; top: 10px; left: 10px; width: 150px; height: 150px; object-fit: contain; z-index: 10; border: 2px dashed #ccc; border-radius: 4px; cursor: move;">`
          
          // Insert the image
          document.execCommand('insertHTML', false, imgHtml)
          
          // Update content and process images
          handleInput({ target: { innerHTML: editorElement.innerHTML } })
          
          // Process the new image
          setTimeout(() => {
            makeImagesResizable()
          }, 300)
        }
      }
      reader.readAsDataURL(file)
    }
  }
  
  // Remove all images
  const removeAllImages = () => {
    if (editorElement) {
      const content = editorElement.innerHTML
      const contentWithoutImages = content.replace(/<img[^>]*>/gi, '')
      editorElement.innerHTML = contentWithoutImages
      handleInput({ target: { innerHTML: editorElement.innerHTML } })
    }
  }
  
  // Clear all content
  const clearContent = () => {
    if (editorElement) {
      editorElement.innerHTML = ''
      handleInput({ target: { innerHTML: editorElement.innerHTML } })
    }
  }
  
  // Set content programmatically
  export function setContent(content) {
    headerText = content
    if (editorElement) {
      editorElement.innerHTML = content
    }
  }
  
  // Get content
  export function getContent() {
    return headerText
  }
  
  // Make images resizable and draggable
  const makeImagesResizable = () => {
    if (!editorElement) return
    
    // Wait a bit for DOM to settle
    setTimeout(() => {
      const images = editorElement.querySelectorAll('img:not(.processed-image)')
      
      images.forEach(img => {
        console.log('Processing image:', img)
        console.log('Image current styles:', img.style.cssText)
        console.log('Image computed styles:', window.getComputedStyle(img))
        
        // Mark as processed
        img.classList.add('processed-image')
        
        // Apply styles directly to image
        img.style.cssText = `
          margin: 5px !important;
          cursor: move !important;
          border: 2px dashed #ccc !important;
          border-radius: 4px !important;
          user-select: none !important;
          position: absolute !important;
          display: block !important;
          max-width: none !important;
          max-height: none !important;
          width: 150px !important;
          height: 150px !important;
          object-fit: contain !important;
          z-index: 10 !important;
        `
        
        // Make draggable
        img.draggable = true
        
        // Add drag functionality
        let isDragging = false
        let dragStartX = 0
        let dragStartY = 0
        let initialLeft = 0
        let initialTop = 0
        
        img.addEventListener('mousedown', (e) => {
          if (e.target === resizeHandle) return // Don't drag if clicking resize handle
          
          isDragging = true
          dragStartX = e.clientX
          dragStartY = e.clientY
          initialLeft = parseInt(img.style.left) || 10
          initialTop = parseInt(img.style.top) || 10
          
          img.style.cursor = 'grabbing'
          e.preventDefault()
        })
        
        document.addEventListener('mousemove', (e) => {
          if (!isDragging) return
          
          const deltaX = e.clientX - dragStartX
          const deltaY = e.clientY - dragStartY
          
          const newLeft = Math.max(0, Math.min(editorElement.offsetWidth - 150, initialLeft + deltaX))
          const newTop = Math.max(0, Math.min(editorElement.offsetHeight - 150, initialTop + deltaY))
          
          img.style.left = newLeft + 'px'
          img.style.top = newTop + 'px'
          
          // Update wrapper position too
          wrapper.style.left = newLeft + 'px'
          wrapper.style.top = newTop + 'px'
        })
        
        document.addEventListener('mouseup', () => {
          if (isDragging) {
            isDragging = false
            img.style.cursor = 'move'
            handleInput({ target: { innerHTML: editorElement.innerHTML } })
          }
        })
        
        // Create wrapper container for resize handle
        const wrapper = document.createElement('div')
        wrapper.className = 'image-wrapper'
        wrapper.style.cssText = `
          position: absolute;
          display: block;
          margin: 5px;
          top: 10px;
          left: 10px;
          z-index: 10;
        `
        
        console.log('Wrapper created with styles:', wrapper.style.cssText)
        
        // Wrap the image
        img.parentNode.insertBefore(wrapper, img)
        wrapper.appendChild(img)
        
        console.log('Image wrapped, wrapper computed styles:', window.getComputedStyle(wrapper))
        console.log('Image computed styles after wrapping:', window.getComputedStyle(img))
        
        // Create resize handle
        const resizeHandle = document.createElement('div')
        resizeHandle.className = 'resize-handle'
        resizeHandle.innerHTML = '↘'
        resizeHandle.style.cssText = `
          position: absolute;
          bottom: -8px;
          right: -8px;
          width: 16px;
          height: 16px;
          background: #007bff;
          color: white;
          border: 2px solid #fff;
          cursor: se-resize;
          border-radius: 50%;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          user-select: none;
        `
        
        wrapper.appendChild(resizeHandle)
        
        // Add resize functionality
        let isResizing = false
        let startX, startY, startWidth, startHeight
        
        resizeHandle.addEventListener('mousedown', (e) => {
          e.preventDefault()
          e.stopPropagation()
          
          isResizing = true
          startX = e.clientX
          startY = e.clientY
          startWidth = img.offsetWidth
          startHeight = img.offsetHeight
          
          console.log('Starting resize:', startWidth, startHeight)
          
          // Visual feedback
          img.style.opacity = '0.8'
          resizeHandle.style.background = '#0056b3'
          
          // Global event listeners
          const handleMouseMove = (e) => {
            if (!isResizing) return
            
            const newWidth = Math.max(30, startWidth + (e.clientX - startX))
            const newHeight = Math.max(30, startHeight + (e.clientY - startY))
            
            img.style.width = newWidth + 'px'
            img.style.height = newHeight + 'px'
            
            console.log('Resizing to:', newWidth, newHeight)
          }
          
          const handleMouseUp = () => {
            isResizing = false
            img.style.opacity = '1'
            resizeHandle.style.background = '#007bff'
            
            console.log('Resize complete')
            
            // Update content
            handleInput({ target: { innerHTML: editorElement.innerHTML } })
            
            // Remove global listeners
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
          }
          
          document.addEventListener('mousemove', handleMouseMove)
          document.addEventListener('mouseup', handleMouseUp)
        })
        
        // Hover effects
        resizeHandle.addEventListener('mouseenter', () => {
          resizeHandle.style.background = '#0056b3'
          resizeHandle.style.transform = 'scale(1.2)'
        })
        
        resizeHandle.addEventListener('mouseleave', () => {
          if (!isResizing) {
            resizeHandle.style.background = '#007bff'
            resizeHandle.style.transform = 'scale(1)'
          }
        })
        
        console.log('Image processed successfully')
      })
    }, 100)
  }
  
  // Initialize default content if empty
  onMount(() => {
    if (!headerText || headerText.trim() === '') {
      const defaultContent = `
        <h5 style="font-weight: bold; margin: 10px 0; text-align: center;">Dr. [Your Name]</h5>
        <p style="font-weight: 600; margin: 5px 0; text-align: center;">Medical Practice</p>
        <p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">City, Country</p>
        <p style="font-size: 0.875rem; margin: 5px 0; text-align: center;">Tel: +1 (555) 123-4567 | Email: doctor@example.com</p>
        <hr style="margin: 10px 0; border: 1px solid #ccc;">
        <p style="font-weight: bold; margin: 5px 0; text-align: center;">PRESCRIPTION</p>
        <p style="margin: 10px 0; text-align: left;">This is some sample text to test floating behavior. When you add an image, this text should wrap around it if floating is working correctly. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
      `
      headerText = defaultContent
      if (editorElement) {
        editorElement.innerHTML = defaultContent
      }
    }
    
    // Make existing images resizable
    setTimeout(() => {
      makeImagesResizable()
    }, 100)
  })
</script>

<div class="header-editor-container">
  <!-- Logo Upload Section -->
  <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
    <div class="flex items-center justify-between mb-3">
      <label class="block text-sm font-medium text-blue-700">
        <i class="fas fa-image mr-2"></i>Logo & Content Management
      </label>
      <div class="flex space-x-2">
        <button 
          type="button"
          on:click={removeAllImages}
          class="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 transition-colors"
          title="Remove all images"
        >
          <i class="fas fa-trash mr-1"></i>Remove Images
        </button>
        <button 
          type="button"
          on:click={clearContent}
          class="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600 transition-colors"
          title="Clear all content"
        >
          <i class="fas fa-eraser mr-1"></i>Clear All
        </button>
      </div>
    </div>
    
    <div class="flex items-center space-x-3">
      <input 
        type="file" 
        accept="image/*"
        on:change={handleLogoUpload}
        class="text-sm text-blue-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-blue-500 file:text-white hover:file:bg-blue-600"
      />
      <span class="text-xs text-gray-600">
        <i class="fas fa-info-circle mr-1"></i>
        Upload logo images to insert into your header
      </span>
    </div>
  </div>
  
  <!-- Formatting Toolbar -->
  <div class="mb-3 p-3 bg-gray-100 rounded-lg border">
    <div class="flex items-center space-x-2 flex-wrap">
      <span class="text-sm font-medium text-gray-700">Formatting:</span>
      
      <!-- Text Formatting -->
      <button 
        type="button"
        on:click={() => applyFormatting('bold')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors font-bold"
        title="Bold (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      <button 
        type="button"
        on:click={() => applyFormatting('italic')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors italic"
        title="Italic (Ctrl+I)"
      >
        <em>I</em>
      </button>
      <button 
        type="button"
        on:click={() => applyFormatting('underline')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Underline (Ctrl+U)"
        style="text-decoration: underline;"
      >
        U
      </button>
      
      <div class="border-l border-gray-300 mx-2 h-6"></div>
      
      <!-- Font Size -->
      <select 
        on:change={(e) => applyFormatting('fontSize', e.target.value)}
        class="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm border-0 focus:outline-none focus:ring-2 focus:ring-teal-500"
        title="Font Size"
      >
        <option value="">Font Size</option>
        <option value="8px">8px</option>
        <option value="10px">10px</option>
        <option value="12px">12px</option>
        <option value="14px">14px</option>
        <option value="16px">16px</option>
        <option value="18px">18px</option>
        <option value="20px">20px</option>
        <option value="24px">24px</option>
        <option value="28px">28px</option>
        <option value="32px">32px</option>
        <option value="36px">36px</option>
      </select>
      
      <div class="border-l border-gray-300 mx-2 h-6"></div>
      
      <!-- Alignment -->
      <button 
        type="button"
        on:click={() => applyFormatting('justifyLeft')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Align Left"
      >
        <i class="fas fa-align-left"></i>
      </button>
      <button 
        type="button"
        on:click={() => applyFormatting('justifyCenter')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Center Text"
      >
        <i class="fas fa-align-center"></i>
      </button>
      <button 
        type="button"
        on:click={() => applyFormatting('justifyRight')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Align Right"
      >
        <i class="fas fa-align-right"></i>
      </button>
      
      <div class="border-l border-gray-300 mx-2 h-6"></div>
      
      <!-- Lists -->
      <button 
        type="button"
        on:click={() => applyFormatting('insertUnorderedList')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Bullet List"
      >
        <i class="fas fa-list-ul"></i>
      </button>
      <button 
        type="button"
        on:click={() => applyFormatting('insertOrderedList')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Numbered List"
      >
        <i class="fas fa-list-ol"></i>
      </button>
      
      <div class="border-l border-gray-300 mx-2 h-6"></div>
      
      <!-- Other -->
      <button 
        type="button"
        on:click={() => applyFormatting('removeFormat')}
        class="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-sm transition-colors"
        title="Remove Formatting"
      >
        <i class="fas fa-remove-format"></i>
      </button>
    </div>
    
    <div class="mt-2 text-xs text-gray-600">
      <i class="fas fa-info-circle mr-1"></i>
      Select text first, then click formatting buttons. All changes save automatically.
    </div>
  </div>
  
  <!-- Rich Text Editor -->
  <div class="editor-wrapper">
    <div 
      bind:this={editorElement}
      class="rich-text-editor border rounded p-3 bg-white min-h-[200px] focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500"
      contenteditable="true"
      bind:innerHTML={headerText}
      on:input={handleInput}
      on:blur={handleBlur}
      style="overflow: visible;"
    >
    </div>
  </div>
  
  <!-- Help Text -->
  <div class="mt-3 p-3 bg-gray-50 rounded-lg">
    <p class="text-xs text-gray-600 mb-2">
      <i class="fas fa-lightbulb mr-1"></i>
      <strong>Rich Text Editor Features:</strong>
    </p>
    <ul class="text-xs text-gray-500 space-y-1">
      <li>• <strong>Text Formatting:</strong> Bold, italic, underline, font size, alignment</li>
      <li>• <strong>Lists:</strong> Bulleted and numbered lists</li>
      <li>• <strong>Images:</strong> Upload, drag to reposition, resize with corner handle</li>
      <li>• <strong>Auto-Save:</strong> Changes saved automatically</li>
      <li>• <strong>Keyboard Shortcuts:</strong> Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline)</li>
      <li>• <strong>Image Controls:</strong> Drag to move, use blue handle to resize</li>
    </ul>
  </div>
</div>

<style>
  .header-editor-container {
    @apply w-full;
  }
  
  .editor-wrapper {
    @apply border border-gray-300 rounded-lg overflow-hidden;
  }
  
  /* Rich text editor styling */
  .rich-text-editor {
    @apply outline-none;
    line-height: 1.6;
    overflow: visible !important;
  }
  
  .rich-text-editor:focus {
    @apply outline-none;
  }
  
  /* Ensure images in editor are properly styled */
  .rich-text-editor img {
    user-select: none !important;
  }
  
  .rich-text-editor {
    position: relative;
    text-align: justify;
  }
  
  .rich-text-editor .image-wrapper {
    position: absolute !important;
    display: block !important;
    margin: 5px !important;
    z-index: 10 !important;
  }
  
  /* Ensure images inside wrappers are positioned */
  .rich-text-editor .image-wrapper img {
    position: absolute !important;
    display: block !important;
    margin: 0 !important;
    width: 150px !important;
    height: 150px !important;
    object-fit: contain !important;
  }
  
  .rich-text-editor .resize-handle {
    position: absolute !important;
    bottom: -8px !important;
    right: -8px !important;
    width: 16px !important;
    height: 16px !important;
    background: #007bff !important;
    color: white !important;
    border: 2px solid #fff !important;
    cursor: se-resize !important;
    border-radius: 50% !important;
    z-index: 1000 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 10px !important;
    font-weight: bold !important;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
    user-select: none !important;
    transition: all 0.2s ease !important;
  }
  
  .rich-text-editor .resize-handle:hover {
    background: #0056b3 !important;
    transform: scale(1.2) !important;
  }
  
  /* Hide resize handles in preview areas */
  .system-header-preview .resize-handle,
  .template-preview .resize-handle,
  [class*="preview"] .resize-handle {
    display: none !important;
  }
  
  /* Default content styling */
  .rich-text-editor h5 {
    font-weight: bold;
    margin: 10px 0;
    text-align: center;
  }
  
  .rich-text-editor p {
    margin: 5px 0;
    text-align: center;
  }
  
  .rich-text-editor hr {
    margin: 10px 0;
    border: 1px solid #ccc;
  }
</style>